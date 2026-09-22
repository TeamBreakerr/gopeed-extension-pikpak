const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.js'), 'utf8');

function runtime(responses = []) {
  const calls = [], logs = [], delays = [];
  let resolve, start;
  class MessageError extends Error {}
  class XHR {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    getResponseHeader() { return this.reply.retryAfter || null; }
    send() {
      calls.push({ method: this.method, url: this.url, timeout: this.timeout });
      const reply = responses.shift();
      assert.ok(reply, 'unexpected extra request');
      if (reply.event) return this[reply.event]();
      this.reply = reply;
      this.status = reply.status || 200;
      this.responseText = JSON.stringify(reply.body || {});
      this.onload();
    }
  }
  const context = vm.createContext({
    XMLHttpRequest: XHR, MessageError,
    setTimeout(fn, ms) { delays.push(ms); fn(); },
    gopeed: { settings: {}, events: { onResolve(fn) { resolve = fn; }, onStart(fn) { start = fn; } },
      logger: Object.fromEntries(['info', 'warn', 'error'].map(k => [k, (...args) => logs.push(args.join(' '))])) },
  });
  vm.runInContext(source, context);
  return { context, calls, logs, delays, resolve, start, MessageError };
}

test('network and timeout failures recover with backoff and finite request timeout', async () => {
  const r = runtime([{ event: 'onerror' }, { event: 'ontimeout' }, { body: { ok: true } }]);
  const result = await r.context.httpJson({ url: 'https://api.example/detail?pass_code=SECRET' });
  assert.equal(result.data.ok, true);
  assert.deepEqual(r.delays, [1000, 2000]);
  assert.ok(r.calls.every(c => c.timeout === 30000));
  assert.ok(!r.logs.join('').includes('SECRET'));
});

test('retry limit is enforced without leaking query secrets', async () => {
  const r = runtime(Array.from({ length: 5 }, () => ({ event: 'onerror' })));
  await assert.rejects(r.context.httpJson({ url: 'https://api.example/detail?token=SECRET' }),
    e => /failed after 5 attempts/.test(e.message) && !e.message.includes('SECRET'));
  assert.equal(r.calls.length, 5);
  assert.deepEqual(r.delays, [1000, 2000, 4000, 8000]);
});

test('retryable HTTP statuses recover and respect Retry-After', async () => {
  const r = runtime([{ status: 503 }, { status: 429, retryAfter: '3' }, { body: { ok: true } }]);
  assert.equal((await r.context.httpJson({ url: 'https://api.example' })).data.ok, true);
  assert.deepEqual(r.delays, [1000, 3000]);
});

test('long server cooldown stops instead of retrying too soon', async () => {
  const r = runtime([{ status: 429, retryAfter: '120' }]);
  await assert.rejects(r.context.httpJson({ url: 'https://api.example' }), /try again later/);
  assert.equal(r.calls.length, 1);
});

test('nonretryable HTTP errors and API password errors are not retried', async () => {
  const r = runtime([{ status: 403, body: { error_code: 123 } }]);
  assert.equal((await r.context.httpJson({ url: 'https://api.example' })).status, 403);
  assert.equal(r.calls.length, 1);
  const password = runtime([{ body: { share_status: 'PASS_CODE_ERROR' } }]);
  const client = new password.context.PikPakClient({});
  client.captchaToken = 'test';
  await assert.rejects(password.context.listAllFiles(client, 'test', '', ''), /分享需要密码/);
  assert.equal(password.calls.length, 1);
});

test('captcha expiry still refreshes once before replaying the request', async () => {
  const r = runtime([{ body: { error_code: 9 } }, { body: { captcha_token: 'fresh' } }, { body: { files: [] } }]);
  const client = new r.context.PikPakClient({});
  client.captchaToken = 'old';
  await client.getShareDetail('test', '', '');
  assert.equal(r.calls.length, 3);
  assert.equal(client.captchaToken, 'fresh');
});

function listingReplies() {
  return [
    { body: { captcha_token: 'test' } },
    { body: { share_status: 'OK', files: [
      { id: 'a', name: 'a.mp4', size: '10' }, { id: 'b', name: 'b.mp4', size: '20' },
    ] } },
  ];
}

test('listing failure is visible and does not publish a partial selection', async () => {
  const r = runtime(Array.from({ length: 5 }, () => ({ event: 'onerror' })));
  const ctx = { req: { url: 'https://mypikpak.com/s/test' } };
  await assert.rejects(r.resolve(ctx), e => e instanceof r.MessageError);
  assert.equal(ctx.res, undefined);
});

test('file selection returns complete metadata without any file-info requests', async () => {
  const r = runtime(listingReplies());
  const ctx = { req: { url: 'https://mypikpak.com/s/test' } };
  await r.resolve(ctx);
  assert.equal(ctx.res.files.length, 2);
  assert.equal(ctx.res.files[1].size, 20);
  assert.equal(ctx.res.files[1].req.labels['pikpak-file-id'], 'b');
  assert.ok(ctx.res.files.every(f => f.req.url.endsWith('.invalid/file')));
  assert.equal(r.calls.length, 2);
  assert.ok(!r.calls.some(c => c.url.includes('file_info')));
});

test('start resolves only selected file, recovers and preserves task options', async () => {
  const r = runtime([...listingReplies(), { body: { captcha_token: 'test' } },
    { event: 'onerror' }, { body: { file_info: { web_content_link: 'https://download.example/b' } } }]);
  const ctx = { req: { url: 'https://mypikpak.com/s/test' } };
  await r.resolve(ctx);
  const req = ctx.res.files[1].req;
  req.extra = { header: { 'X-Test': 'keep' } };
  req.proxy = { mode: 'follow' };
  await r.start({ task: { meta: { req } } });
  assert.equal(req.url, 'https://download.example/b');
  assert.equal(req.extra.header['X-Test'], 'keep');
  assert.equal(req.proxy.mode, 'follow');
  assert.ok(r.calls.filter(c => c.url.includes('file_info')).every(c => c.url.includes('file_id=b')));
  assert.ok(ctx.res.files[0].req.url.includes('.invalid/'));
});

test('start failure invalidates stale URL and raises MessageError', async () => {
  const r = runtime([{ body: { captcha_token: 'test' } },
    ...Array.from({ length: 5 }, () => ({ event: 'onerror' }))]);
  const req = { url: 'https://download.example/expired', labels: {
    'pikpak-share-file': '1', 'pikpak-share-id': 'test', 'pikpak-file-id': 'a',
  } };
  await assert.rejects(r.start({ task: { meta: { req } } }), e => e instanceof r.MessageError);
  assert.equal(req.url, r.context.PENDING_URL);
});

test('missing download URL cannot fall back to downloading a share page', async () => {
  const r = runtime([{ body: { captcha_token: 'test' } }, { body: { file_info: {} } }]);
  const req = { url: 'https://mypikpak.com/s/test', labels: {
    'pikpak-share-file': '1', 'pikpak-share-id': 'test', 'pikpak-file-id': 'a',
  } };
  await assert.rejects(r.start({ task: { meta: { req } } }), /没有可用下载地址/);
  assert.equal(req.url, r.context.PENDING_URL);
});
