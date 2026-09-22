/**
 * Gopeed 扩展：PikPak 分享下载
 *
 * 解析 https://mypikpak.com/s/{share_id}[/{pass_code_token}] 形式的分享链接，
 * 无需账号；签名算法和 API 流程参考 Alist 的 pikpak_share 驱动。
 */

// ====== 常量：Web 端签名算法 ======
var WEB_CLIENT_ID = "YUMx5nI8ZU8Ap8pm";
var WEB_CLIENT_VERSION = "2.0.0";
var WEB_PACKAGE_NAME = "mypikpak.com";
var WEB_ALGORITHMS = [
  "C9qPpZLN8ucRTaTiUMWYS9cQvWOE",
  "+r6CQVxjzJV6LCV",
  "F",
  "pFJRC",
  "9WXYIDGrwTCz2OiVlgZa90qpECPD6olt",
  "/750aCr4lm/Sly/c",
  "RB+DT/gZCrbV",
  "",
  "CyLsf7hdkIRxRm215hl",
  "7xHvLi2tOYP0Y92b",
  "ZGTXXxu8E/MIWaEDB+Sm/",
  "1UI3",
  "E7fP5Pfijd+7K+t6Tg/NhuLq0eEUVChpJSkrKxpO",
  "ihtqpG6FMt65+Xk+tWUH2",
  "NhXXU9rg4XXdzo7u5o",
];
var DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

// ====== 工具函数 ======
/* Joseph Myers MD5 (CC0 / public domain), https://www.myersdaily.org/joseph/javascript/md5-text.html
 * 处理 UTF-8 输入。
 */
function md5Hex(str) {
  return md5Str(unescape(encodeURIComponent(str)));
}
function md5cycle(x, k) {
  var a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);

  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);

  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);

  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);

  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}
function cmn(q, a, b, x, s, t) {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
function md51(s) {
  var n = s.length;
  var state = [1732584193, -271733879, -1732584194, 271733878];
  var i;
  for (i = 64; i <= s.length; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  s = s.substring(i - 64);
  var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < s.length; i++)
    tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}
function md5blk(s) {
  var md5blks = [], i;
  for (i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) +
      (s.charCodeAt(i + 1) << 8) +
      (s.charCodeAt(i + 2) << 16) +
      (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}
var hex_chr = "0123456789abcdef".split("");
function rhex(n) {
  var s = "", j = 0;
  for (; j < 4; j++)
    s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
  return s;
}
function hex(x) {
  for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
  return x.join("");
}
function md5Str(s) {
  return hex(md51(s));
}
function add32(a, b) {
  return (a + b) & 0xffffffff;
}

function genDeviceId() {
  // 32 位小写 hex，类似 uuid 去横线
  var hex = "0123456789abcdef";
  var s = "";
  for (var i = 0; i < 32; i++) {
    s += hex.charAt(Math.floor(Math.random() * 16));
  }
  return s;
}

function captchaSign(deviceId, ts) {
  var s = WEB_CLIENT_ID + WEB_CLIENT_VERSION + WEB_PACKAGE_NAME + deviceId + ts;
  for (var i = 0; i < WEB_ALGORITHMS.length; i++) {
    s = md5Hex(s + WEB_ALGORITHMS[i]);
  }
  return "1." + s;
}

function buildQuery(params) {
  var parts = [];
  for (var k in params) {
    if (params[k] === undefined || params[k] === null || params[k] === "") continue;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  }
  return parts.join("&");
}

function parseShareUrl(rawUrl) {
  // 不依赖 URL 构造器（goja 默认未实现）
  var m = /^https?:\/\/[^/]+(\/[^?#]*)/i.exec(rawUrl);
  if (!m) {
    throw new Error("无法解析链接：" + rawUrl);
  }
  var path = m[1];
  var parts = path.split("/").filter(function (x) {
    return x !== "";
  });
  if (parts.length < 2 || parts[0] !== "s") {
    throw new Error("不是合法的 PikPak 分享链接：" + rawUrl);
  }
  // URL 第二段是 parent_id（要直接打开的子目录），不是 pass_code_token；
  // pass_code_token 仅当分享有密码时通过 /drive/v1/share 用密码换取。
  return {
    shareId: parts[1],
    initialParentId: parts.length >= 3 ? parts[2] : "",
  };
}

// ====== HTTP 客户端封装 ======
var REQUEST_TIMEOUT_MS = 30000;
var REQUEST_ATTEMPTS = 5;

function waitForRetry(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function requestJsonOnce(opts) {
  // Gopeed's fetch hides transport errors and offers no request timeout option.
  // Its XMLHttpRequest implementation supports a real HTTP client timeout.
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(opts.method || "GET", opts.url);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    var headers = opts.headers || {};
    for (var key in headers) xhr.setRequestHeader(key, headers[key]);
    xhr.onload = function () {
      var text = xhr.responseText || "";
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON */ }
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        text: text,
        data: data,
        retryAfter: xhr.getResponseHeader("Retry-After"),
      });
    };
    xhr.onerror = function () { reject(new Error("network connection failed")); };
    xhr.ontimeout = function () { reject(new Error("request timed out (30s)")); };
    xhr.onabort = function () { reject(new Error("request aborted")); };
    xhr.send(opts.body || null);
  });
}

function httpJson(opts) {
  // Never log queries, passwords, captcha tokens or signed download URLs.
  var endpoint = (opts.method || "GET") + " " + opts.url.split("?")[0];
  function attempt(number) {
    return requestJsonOnce(opts).then(function (r) {
      if (r.status === 408 || r.status === 429 || r.status >= 500) {
        return retry(number, "HTTP " + r.status, r.retryAfter);
      }
      return r;
    }, function () {
      return retry(number, "network error or timeout", null);
    });
  }
  function retry(number, reason, retryAfter) {
    if (number >= REQUEST_ATTEMPTS) {
      throw new Error(endpoint + " failed after " + number + " attempts: " + reason);
    }
    var delay = Math.pow(2, number - 1) * 1000;
    if (retryAfter) {
      var seconds = Number(retryAfter);
      var requested = isNaN(seconds) ? Date.parse(retryAfter) - Date.now() : seconds * 1000;
      // Do not retry earlier than the server requests, or wait indefinitely.
      if (requested > 60000) throw new Error(endpoint + " rate limited; try again later");
      if (requested > delay) delay = requested;
    }
    gopeed.logger.warn("[pikpak] retry " + number + "/" + (REQUEST_ATTEMPTS - 1) +
      " " + endpoint + " " + reason + " wait=" + delay + "ms");
    return waitForRetry(delay).then(function () { return attempt(number + 1); });
  }
  return attempt(1);
}

function PikPakClient(settings) {
  this.apiHost = (settings && settings.api_host) || "api-drive.mypikpak.com";
  this.userHost = (settings && settings.user_host) || "user.mypikpak.com";
  this.useTrans = settings && settings.use_transcoding === "1";
  this.sharePwd = (settings && settings.share_pwd) || "";
  this.deviceId = genDeviceId();
  this.captchaToken = "";
  this.passCodeToken = "";
}

PikPakClient.prototype._headers = function () {
  return {
    "User-Agent": DEFAULT_UA,
    "Content-Type": "application/json",
    "X-Client-ID": WEB_CLIENT_ID,
    "X-Device-ID": this.deviceId,
    "X-Captcha-Token": this.captchaToken || "",
  };
};

PikPakClient.prototype.refreshCaptcha = function (action) {
  var ts = String(new Date().getTime());
  var sign = captchaSign(this.deviceId, ts);
  var body = {
    action: action,
    captcha_token: this.captchaToken || "",
    client_id: WEB_CLIENT_ID,
    device_id: this.deviceId,
    meta: {
      captcha_sign: sign,
      client_version: WEB_CLIENT_VERSION,
      package_name: WEB_PACKAGE_NAME,
      timestamp: ts,
      user_id: "",
    },
    redirect_uri: "",
  };
  var self = this;
  return httpJson({
    url: "https://" + this.userHost + "/v1/shield/captcha/init",
    method: "POST",
    headers: this._headers(),
    body: JSON.stringify(body),
  }).then(function (r) {
    if (!r.ok || !r.data || !r.data.captcha_token) {
      throw new Error(
        "captcha/init 失败：" +
          r.status +
          " " +
          "（检查代理连接或验证状态）"
      );
    }
    self.captchaToken = r.data.captcha_token;
    return r.data.captcha_token;
  });
};

// 自动带 captcha 重试一次
PikPakClient.prototype._request = function (path, method, query) {
  var self = this;
  var url = "https://" + this.apiHost + path;
  if (query) {
    var q = buildQuery(query);
    if (q) url += (url.indexOf("?") >= 0 ? "&" : "?") + q;
  }
  var doCall = function () {
    return httpJson({ url: url, method: method, headers: self._headers() });
  };
  var action = method.toUpperCase() + ":" + path;
  var ensure = self.captchaToken
    ? Promise.resolve()
    : self.refreshCaptcha(action);
  return ensure
    .then(doCall)
    .then(function (r) {
      if (r.data && r.data.error_code === 9) {
        // 验证码失效，重刷一次
        return self.refreshCaptcha(action).then(doCall);
      }
      return r;
    })
    .then(function (r) {
      if (!r.ok || !r.data) {
        throw new Error("PikPak 请求失败 " + path + " HTTP " + r.status);
      }
      if (r.data.error_code) {
        throw new Error(
          "PikPak 接口错误 " +
            r.data.error_code +
            "：" +
            path
        );
      }
      return r.data;
    });
};

PikPakClient.prototype.getShareInfo = function (shareId, passCode) {
  // 用于密码型分享，换取 pass_code_token
  return this._request("/drive/v1/share", "GET", {
    share_id: shareId,
    pass_code: passCode || "",
    thumbnail_size: "SIZE_LARGE",
    limit: "100",
  });
};

PikPakClient.prototype.getShareDetail = function (
  shareId,
  parentId,
  pageToken
) {
  return this._request("/drive/v1/share/detail", "GET", {
    share_id: shareId,
    parent_id: parentId || "",
    pass_code_token: this.passCodeToken || "",
    thumbnail_size: "SIZE_LARGE",
    with_audit: "true",
    limit: "100",
    page_token: pageToken || "",
    filters: '{"phase":{"eq":"PHASE_TYPE_COMPLETE"},"trashed":{"eq":false}}',
  });
};

PikPakClient.prototype.getFileInfo = function (shareId, fileId) {
  return this._request("/drive/v1/share/file_info", "GET", {
    share_id: shareId,
    file_id: fileId,
    pass_code_token: this.passCodeToken || "",
  });
};

// ====== 业务逻辑 ======
function listAllFiles(client, shareId, parentId, pathPrefix) {
  // 递归列出所有文件，返回 [{name, path, size, id}]
  var out = [];
  var pageToken = "";
  var page = 0;
  function loop() {
    page++;
    return client
      .getShareDetail(shareId, parentId, pageToken)
      .then(function (resp) {
        if (
          resp.share_status === "PASS_CODE_EMPTY" ||
          resp.share_status === "PASS_CODE_ERROR"
        ) {
          throw new Error(
            "分享需要密码，请在扩展设置 share_pwd 中填入访问密码"
          );
        }
        if (resp.share_status && resp.share_status !== "OK") {
          throw new Error(
            "分享状态异常：" +
              resp.share_status +
              " " +
              (resp.share_status_text || "")
          );
        }
        var files = resp.files || [];
        var subTasks = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (f.kind === "drive#folder") {
            subTasks.push({ folder: f });
          } else {
            out.push({
              id: f.id,
              name: f.name,
              path: pathPrefix,
              size: parseInt(f.size, 10) || 0,
            });
          }
        }
        pageToken = resp.next_page_token || "";
        var next = pageToken ? loop() : Promise.resolve();
        return next.then(function () {
          // 串行处理子文件夹（避免并发触发风控）
          return subTasks.reduce(function (p, t) {
            return p.then(function () {
              var sub = pathPrefix
                ? pathPrefix + "/" + t.folder.name
                : t.folder.name;
              return listAllFiles(client, shareId, t.folder.id, sub).then(
                function (childFiles) {
                  out = out.concat(childFiles);
                }
              );
            });
          }, Promise.resolve());
        });
      });
  }
  return loop().then(function () {
    return out;
  });
}

function pickDownloadUrl(fileInfo, useTrans) {
  if (!fileInfo) return "";
  var direct = fileInfo.web_content_link || "";
  var medias = fileInfo.medias || [];
  if (useTrans && medias.length > 1 && medias[1].link && medias[1].link.url) {
    return medias[1].link.url;
  }
  if (direct) return direct;
  if (medias.length > 0 && medias[0].link && medias[0].link.url) {
    return medias[0].link.url;
  }
  return "";
}

gopeed.events.onResolve(function (ctx) {
  var settings = gopeed.settings || {};
  var parsed = parseShareUrl(ctx.req.url);
  var client = new PikPakClient(settings);

  gopeed.logger.info(
    "[pikpak] resolve shareId=" + parsed.shareId,
    "initialParentId=" + (parsed.initialParentId || "(none)")
  );

  // 1) pass_code_token 默认空：仅在有密码分享时用密码调 /drive/v1/share 换取
  var passCodeTokenPromise;
  if (settings.share_pwd) {
    passCodeTokenPromise = client
      .getShareInfo(parsed.shareId, settings.share_pwd)
      .then(function (info) {
        return info.pass_code_token || "";
      });
  } else {
    passCodeTokenPromise = Promise.resolve("");
  }

  return passCodeTokenPromise
    .then(function (token) {
      client.passCodeToken = token;
      // 从根目录开始递归列；URL 里的 initialParentId 仅是 UI 跳转参数，不影响列全部文件
      return listAllFiles(client, parsed.shareId, "", "");
    })
    .then(function (files) {
      if (!files.length) {
        throw new Error("分享内未找到任何可下载的文件");
      }
      gopeed.logger.info("[pikpak] flat files:", files.length);
      // Return metadata before the desktop UI's 60-second receive timeout.
      // Resolve only selected files when each download actually starts.
      ctx.res = {
        name: files.length > 1 ? "PikPak-" + parsed.shareId.slice(-10) : "",
        files: files.map(function (item) {
          return {
            name: item.name,
            path: item.path || "",
            size: item.size,
            req: {
              url: PENDING_URL,
              labels: {
                "pikpak-share-file": "1",
                "pikpak-share-id": parsed.shareId,
                "pikpak-file-id": item.id,
              },
            },
          };
        }),
      };
      gopeed.logger.info("[pikpak] listed " + files.length + " files; download URLs deferred until start");
    }).catch(function (err) {
      var message = "PikPak 解析失败：" + err.message;
      gopeed.logger.error("[pikpak] " + message);
      // Gopeed propagates MessageError to the UI; ordinary Errors fall back to HTTP.
      throw new MessageError(message);
    });
});

// A reserved, nonresolving domain prevents an unresolved task downloading HTML.
var PENDING_URL = "https://pikpak-pending.invalid/file";

gopeed.events.onStart(function (ctx) {
  var req = ctx.task.meta.req;
  var labels = req.labels || {};
  if (labels["pikpak-share-file"] !== "1") return;
  // Also invalidate old signed URLs on resume, before any network request.
  // Gopeed 1.9.3 logs onStart errors but continues: fail closed if resolution fails.
  req.url = PENDING_URL;
  var client = new PikPakClient(gopeed.settings || {});
  var shareId = labels["pikpak-share-id"];
  var fileId = labels["pikpak-file-id"];
  return Promise.resolve().then(function () {
    if (!shareId || !fileId) throw new Error("缺少分享或文件标识，请重新创建任务");
    if (client.sharePwd) {
      return client.getShareInfo(shareId, client.sharePwd).then(function (info) {
        client.passCodeToken = info.pass_code_token || "";
      });
    }
  }).then(function () {
    return client.getFileInfo(shareId, fileId);
  }).then(function (info) {
    var url = pickDownloadUrl(info.file_info || info, client.useTrans);
    if (!url || !/^https?:\/\//i.test(url)) throw new Error("文件没有可用下载地址");
    req.extra = req.extra || {};
    req.extra.header = req.extra.header || {};
    req.extra.header["User-Agent"] = DEFAULT_UA;
    req.extra.header.Referer = "https://mypikpak.com/";
    req.url = url;
    gopeed.logger.info("[pikpak] download URL ready");
  }).catch(function (err) {
    var message = "PikPak 下载地址解析失败：" + err.message;
    gopeed.logger.error("[pikpak] " + message);
    throw new MessageError(message);
  });
});
