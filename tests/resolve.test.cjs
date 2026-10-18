// Offline tests for the two-stage flow. Network-layer tests come from
// TeamBreakerr/gopeed-extension-pikpak PR #1 (learnr-reader), adapted to v1.1 (login + save-to-drive).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../index.js'), 'utf8');

function runtime(responses = [], settings = {}, storage = {}) {
  const calls = [], logs = [], delays = [];
  let resolve, start;
  class MessageError extends Error {}
  class XHR {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader() {}
    getResponseHeader() { return this.reply.retryAfter || null; }
    send(body) {
      calls.push({ method: this.method, url: this.url, timeout: this.timeout, body });
      const reply = responses.shift();
      assert.ok(reply, 'unexpected extra request ' + this.method + ' ' + this.url);
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
    gopeed: {
      settings,
      events: { onResolve(fn) { resolve = fn; }, onStart(fn) { start = fn; } },
      storage: { get: k => (k in storage ? storage[k] : null), set: (k, v) => { storage[k] = String(v); } },
      logger: Object.fromEntries(['debug', 'info', 'warn', 'error'].map(k => [k, (...a) => logs.push(a.join(' '))])),
    },
  });
  vm.runInContext(source, context);
  return { context, calls, logs, delays, resolve, start, MessageError, storage };
}

const PENDING = 'https://pikpak-pending.invalid/file';
const labels = (id, ancestors = '') => ({
  'pikpak-share-file': '1', 'pikpak-share-id': 'test', 'pikpak-file-id': id, 'pikpak-ancestors': ancestors,
});
function loggedInStorage() {
  return { device_id: 'dev', account: 'u', access_token: 'tok', refresh_token: 'rt', user_id: 'uid',
    expires_at: String(Date.now() + 3600e3) };
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
});

test('retryable HTTP statuses recover and respect Retry-After', async () => {
  const r = runtime([{ status: 503 }, { status: 429, retryAfter: '3' }, { body: { ok: true } }]);
  assert.equal((await r.context.httpJson({ url: 'https://api.example' })).data.ok, true);
  assert.deepEqual(r.delays, [1000, 3000]);
});

function listingReplies() {
  return [
    { body: { captcha_token: 'c' } },
    { body: { share_status: 'OK', files: [
      { id: 'a', name: 'a.mp4', size: '10' }, { id: 'b', name: 'b.zip', size: '20' },
      { id: 'f', name: 'sub', kind: 'drive#folder' },
    ] } },
    { body: { share_status: 'OK', files: [{ id: 'c', name: 'c.zip', size: '30' }] } },
  ];
}

test('resolve lists every file with sizes and no per-file link requests', async () => {
  const r = runtime(listingReplies());
  const ctx = { req: { url: 'https://mypikpak.com/s/test' } };
  await r.resolve(ctx);
  assert.equal(ctx.res.files.length, 3);
  assert.equal(ctx.res.files[2].path, 'sub');
  assert.equal(ctx.res.files[2].size, 30);
  assert.equal(ctx.res.files[2].req.labels['pikpak-ancestors'], 'f');
  assert.ok(ctx.res.files.every(f => f.req.url === PENDING));
  assert.equal(r.calls.length, 3);
  assert.ok(!r.calls.some(c => /file_info|restore/.test(c.url)));
});

test('listing failure is a visible error, not a fallback download', async () => {
  const r = runtime(Array.from({ length: 5 }, () => ({ event: 'onerror' })));
  const ctx = { req: { url: 'https://mypikpak.com/s/test' } };
  await assert.rejects(r.resolve(ctx), e => e instanceof r.MessageError);
  assert.equal(ctx.res, undefined);
});

test('start gets a link for the selected video only and keeps task options', async () => {
  const r = runtime([{ body: { captcha_token: 'c' } },
    { body: { file_info: { web_content_link: 'https://download.example/a' } } }]);
  const req = { url: PENDING, labels: labels('a'), extra: { header: { 'X-Test': 'keep' } } };
  await r.start({ task: { meta: { req } } });
  assert.equal(req.url, 'https://download.example/a');
  assert.equal(req.extra.header['X-Test'], 'keep');
  assert.ok(r.calls[1].url.includes('file_id=a'));
});

test('anonymous non-video file fails closed with a login hint', async () => {
  const r = runtime([{ body: { captcha_token: 'c' } }, { body: { file_info: {} } }]);
  const req = { url: 'https://download.example/expired', labels: labels('b') };
  await assert.rejects(r.start({ task: { meta: { req } } }), /账号密码/);
  assert.equal(req.url, PENDING);
});

test('logged in: start saves only the selected file to the drive', async () => {
  const r = runtime([
    { body: { captcha_token: 'c' } },
    { body: { file_info: {} } },
    { body: { restore_status: 'RESTORE_COMPLETE', params: { trace_file_ids: '{"c":"own-c"}' } } },
    { body: { web_content_link: 'https://download.example/own-c' } },
  ], { username: 'u', password: 'p' }, loggedInStorage());
  const req = { url: PENDING, labels: labels('c', 'f') };
  await r.start({ task: { meta: { req } } });
  assert.equal(req.url, 'https://download.example/own-c');
  const restore = r.calls.find(c => c.url.includes('/share/restore'));
  const body = JSON.parse(restore.body);
  assert.deepEqual(body.file_ids, ['c']);
  assert.deepEqual(body.ancestor_ids, ['f']);
  assert.equal(r.storage['restored:test:c'], 'own-c');
});

test('logged in: a file saved before is reused, not saved again', async () => {
  const st = Object.assign(loggedInStorage(), { 'restored:test:c': 'own-c' });
  const r = runtime([
    { body: { captcha_token: 'c' } },
    { body: { file_info: {} } },
    { body: { web_content_link: 'https://download.example/own-c2' } },
  ], { username: 'u', password: 'p' }, st);
  const req = { url: PENDING, labels: labels('c', 'f') };
  await r.start({ task: { meta: { req } } });
  assert.equal(req.url, 'https://download.example/own-c2');
  assert.ok(!r.calls.some(c => c.url.includes('/share/restore')));
});

test('other tasks are left alone', async () => {
  const r = runtime([]);
  const req = { url: 'https://example.com/x', labels: {} };
  await r.start({ task: { meta: { req } } });
  assert.equal(req.url, 'https://example.com/x');
});
