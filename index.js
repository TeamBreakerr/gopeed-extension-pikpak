/**
 * Gopeed 扩展：PikPak 分享下载
 *
 * 解析 https://mypikpak.com/s/{share_id}[/{parent_id}] 形式的分享链接；
 * 签名算法和 API 流程参考 Alist/OpenList 的 pikpak / pikpak_share 驱动。
 *
 * 匿名访问时 PikPak 只给视频返回播放链接（medias），web_content_link 恒为空，
 * 所以 zip 等非视频文件必须登录（账号密码或 refresh_token）后才能拿到下载地址。
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

// gopeed.storage 是按扩展隔离的持久化 KV（值为字符串），用来跨解析保存登录态
function storageGet(key) {
  try {
    var v = gopeed.storage ? gopeed.storage.get(key) : null;
    return v === null || v === undefined ? "" : String(v);
  } catch (e) {
    return "";
  }
}
function storageSet(key, value) {
  try {
    if (gopeed.storage) gopeed.storage.set(key, value ? String(value) : "");
  } catch (e) {
    // 存储不可用时退化为单次会话
  }
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
function httpJson(opts) {
  // opts: { url, method, headers, body }
  return fetch(opts.url, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || undefined,
  }).then(function (resp) {
    return resp.text().then(function (text) {
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        // 非 JSON
      }
      return { status: resp.status, ok: resp.ok, text: text, data: data };
    });
  });
}

function PikPakClient(settings) {
  this.apiHost = (settings && settings.api_host) || "api-drive.mypikpak.net";
  this.userHost = (settings && settings.user_host) || "user.mypikpak.net";
  this.useTrans = settings && settings.use_transcoding === "1";
  this.sharePwd = (settings && settings.share_pwd) || "";
  this.username = String((settings && settings.username) || "").trim();
  this.password = String((settings && settings.password) || "");
  // 从浏览器控制台复制时常带上两侧引号
  this.refreshTokenSetting = String((settings && settings.refresh_token) || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
  // 登录态和设备绑定，设备 ID 必须持久化，否则每次都像新设备登录、容易触发验证
  this.deviceId = storageGet("device_id");
  if (!this.deviceId) {
    this.deviceId = genDeviceId();
    storageSet("device_id", this.deviceId);
  }
  this.captchaToken = "";
  this.passCodeToken = "";
  this.accessToken = "";
  this.refreshToken = "";
  this.userId = "";
}

PikPakClient.prototype._headers = function () {
  var h = {
    "User-Agent": DEFAULT_UA,
    "Content-Type": "application/json",
    "X-Client-ID": WEB_CLIENT_ID,
    "X-Device-ID": this.deviceId,
    "X-Captcha-Token": this.captchaToken || "",
  };
  if (this.accessToken) {
    h.Authorization = "Bearer " + this.accessToken;
  }
  return h;
};

// extraMeta：登录前用 {email|phone_number|username}，登录后默认带 user_id
PikPakClient.prototype.refreshCaptcha = function (action, extraMeta) {
  var ts = String(new Date().getTime());
  var sign = captchaSign(this.deviceId, ts);
  var meta = {
    captcha_sign: sign,
    client_version: WEB_CLIENT_VERSION,
    package_name: WEB_PACKAGE_NAME,
    timestamp: ts,
  };
  if (extraMeta) {
    for (var k in extraMeta) meta[k] = extraMeta[k];
  } else {
    meta.user_id = this.userId || "";
  }
  var body = {
    action: action,
    captcha_token: this.captchaToken || "",
    client_id: WEB_CLIENT_ID,
    device_id: this.deviceId,
    meta: meta,
    redirect_uri: "xlaccsdk01://xbase.cloud/callback?state=harbor",
  };
  var self = this;
  return httpJson({
    url:
      "https://" +
      this.userHost +
      "/v1/shield/captcha/init?client_id=" +
      WEB_CLIENT_ID,
    method: "POST",
    headers: this._headers(),
    body: JSON.stringify(body),
  }).then(function (r) {
    if (!r.ok || !r.data || !r.data.captcha_token) {
      throw new Error(
        "captcha/init 失败：" +
          r.status +
          " " +
          (r.data && r.data.error_description ? r.data.error_description : r.text)
      );
    }
    self.captchaToken = r.data.captcha_token;
    return r.data;
  });
};

// ====== 登录态：账号密码 / refresh_token，token 存在 gopeed.storage 里复用 ======
PikPakClient.prototype.hasCredentials = function () {
  return !!(this.refreshTokenSetting || (this.username && this.password));
};

// Web 端是公开客户端：带浏览器 UA 时不能传 client_secret，否则报 error_code 7
PikPakClient.prototype._authPost = function (path, body) {
  return httpJson({
    url: "https://" + this.userHost + path + "?client_id=" + WEB_CLIENT_ID,
    method: "POST",
    headers: {
      "User-Agent": DEFAULT_UA,
      "Content-Type": "application/json",
      "X-Client-ID": WEB_CLIENT_ID,
      "X-Device-ID": this.deviceId,
    },
    body: JSON.stringify(body),
  });
};

PikPakClient.prototype._saveToken = function (data) {
  var expiresIn = parseInt(data.expires_in, 10) || 7200;
  this.accessToken = data.access_token;
  this.refreshToken = data.refresh_token;
  this.userId = data.sub || "";
  // 匿名阶段拿的 captcha_token 不带 user_id，登录后重新取
  this.captchaToken = "";
  storageSet("access_token", this.accessToken);
  storageSet("refresh_token", this.refreshToken);
  storageSet("user_id", this.userId);
  // 提前 5 分钟视为过期
  storageSet("expires_at", new Date().getTime() + (expiresIn - 300) * 1000);
  storageSet("account", this.username);
};

PikPakClient.prototype._clearToken = function () {
  this.accessToken = "";
  this.refreshToken = "";
  this.userId = "";
  storageSet("access_token", "");
  storageSet("refresh_token", "");
  storageSet("user_id", "");
  storageSet("expires_at", "");
};

function authErrorText(r) {
  if (r.data && (r.data.error_description || r.data.error)) {
    return (
      (r.data.error_code ? r.data.error_code + " " : "") +
      (r.data.error_description || r.data.error)
    );
  }
  return r.status + " " + r.text;
}

PikPakClient.prototype.signin = function () {
  var self = this;
  if (!this.username || !this.password) {
    return Promise.reject(
      new Error(
        "refresh_token 已失效，请在扩展设置中重新填写 refresh_token，或填写账号密码"
      )
    );
  }
  var meta = {};
  if (/\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*/.test(this.username)) {
    meta.email = this.username;
  } else if (this.username.length >= 11 && this.username.length <= 18) {
    meta.phone_number = this.username;
  } else {
    meta.username = this.username;
  }
  this._clearToken();
  this.captchaToken = "";
  return this.refreshCaptcha("POST:/v1/auth/signin", meta)
    .then(function (captcha) {
      if (captcha.url) {
        // 需要滑块等人机验证，扩展里没法完成
        throw new Error(
          "登录要求人机验证，请改用 refresh_token（见扩展 README）"
        );
      }
      return self._authPost("/v1/auth/signin", {
        captcha_token: self.captchaToken,
        client_id: WEB_CLIENT_ID,
        username: self.username,
        password: self.password,
      });
    })
    .then(function (r) {
      if (!r.data || !r.data.access_token || !r.data.refresh_token) {
        throw new Error("登录失败：" + authErrorText(r));
      }
      self._saveToken(r.data);
      gopeed.logger.info("[pikpak] signed in, user_id=" + self.userId);
    });
};

PikPakClient.prototype.refreshAccessToken = function () {
  var self = this;
  return this._authPost("/v1/auth/token", {
    client_id: WEB_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: this.refreshToken,
  }).then(function (r) {
    if (r.data && r.data.access_token && r.data.refresh_token) {
      self._saveToken(r.data);
      return;
    }
    gopeed.logger.warn("[pikpak] refresh_token 刷新失败：" + authErrorText(r));
    if (!self.username || !self.password) {
      throw new Error(
        "refresh_token 无效（" + authErrorText(r) + "），请重新获取后填写"
      );
    }
    return self.signin();
  });
};

// 有凭据时确保持有可用的 access_token；返回是否处于登录状态
PikPakClient.prototype.ensureLogin = function () {
  if (!this.hasCredentials()) {
    return Promise.resolve(false);
  }
  // 设置里粘贴了新的 refresh_token：以它为准（刷新后会轮换，新值存在 storage 里）
  if (
    this.refreshTokenSetting &&
    this.refreshTokenSetting !== storageGet("seed_refresh_token")
  ) {
    var seed = this.refreshTokenSetting;
    this._clearToken();
    this.refreshToken = seed;
    // 成功后才记下，失败时下次仍会重试这个值并给出真实原因
    return this.refreshAccessToken().then(function () {
      storageSet("seed_refresh_token", seed);
      return true;
    });
  }
  // 换了账号：旧 token 作废
  if (storageGet("account") !== this.username) {
    this._clearToken();
  } else {
    this.accessToken = storageGet("access_token");
    this.refreshToken = storageGet("refresh_token");
    this.userId = storageGet("user_id");
  }
  var expiresAt = parseInt(storageGet("expires_at"), 10) || 0;
  var p;
  if (this.accessToken && new Date().getTime() < expiresAt) {
    p = Promise.resolve();
  } else if (this.refreshToken) {
    p = this.refreshAccessToken();
  } else {
    p = this.signin();
  }
  return p.then(function () {
    return true;
  });
};

// 验证码失效 / access_token 过期时自动刷新后重试（最多重试 2 次）
PikPakClient.prototype._request = function (path, method, query, body) {
  var self = this;
  var url = "https://" + this.apiHost + path;
  if (query) {
    var q = buildQuery(query);
    if (q) url += (url.indexOf("?") >= 0 ? "&" : "?") + q;
  }
  var action = method.toUpperCase() + ":" + path;
  var attempt = 0;
  var doCall = function () {
    attempt++;
    var ensure = self.captchaToken
      ? Promise.resolve()
      : self.refreshCaptcha(action);
    return ensure
      .then(function () {
        return httpJson({
          url: url,
          method: method,
          headers: self._headers(),
          body: body ? JSON.stringify(body) : undefined,
        });
      })
      .then(function (r) {
        var code = r.data && r.data.error_code;
        if (attempt > 2) return r;
        if (code === 9) {
          // 验证码失效
          return self.refreshCaptcha(action).then(doCall);
        }
        if ((code === 16 || code === 4121 || code === 4122) && self.refreshToken) {
          // access_token 过期
          return self.refreshAccessToken().then(doCall);
        }
        return r;
      });
  };
  return doCall()
    .then(function (r) {
      if (!r.data) {
        throw new Error("接口返回非 JSON：" + r.status + " " + r.text);
      }
      if (r.data.error_code) {
        throw new Error(
          "接口错误 " +
            r.data.error_code +
            "：" +
            (r.data.error_description || r.data.error || r.text)
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

// ====== 转存：PikPak 对非视频文件只提供"存到自己网盘再下载"（网页端的下载按钮也只是引导转存） ======
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// trace_file_ids 是 JSON：{分享内文件 ID: 自己网盘里的文件 ID}
function parseTraceIds(s) {
  try {
    return (s && JSON.parse(s)) || {};
  } catch (e) {
    return {};
  }
}

PikPakClient.prototype.waitTask = function (taskId) {
  var self = this;
  var tries = 0;
  function poll() {
    tries++;
    return sleep(1000)
      .then(function () {
        return self._request("/drive/v1/tasks/" + taskId, "GET");
      })
      .then(function (task) {
        var params = task.params || {};
        if (task.phase === "PHASE_TYPE_ERROR" || params.error_detail) {
          throw new Error(
            "转存失败：" + (task.message || params.error_detail || task.phase)
          );
        }
        if (task.phase === "PHASE_TYPE_COMPLETE") {
          return params.trace_file_ids;
        }
        if (tries >= 60) {
          throw new Error("转存超时（任务 " + taskId + "）");
        }
        return poll();
      });
  }
  return poll();
};

// 返回 {分享内文件 ID: 自己网盘里的文件 ID}；ancestorIds 是文件所在目录在分享内的路径
PikPakClient.prototype.restore = function (shareId, fileIds, ancestorIds) {
  var self = this;
  var body = {
    share_id: shareId,
    pass_code_token: this.passCodeToken || "",
    file_ids: fileIds,
    params: { trace_file_ids: fileIds.join(",") },
  };
  if (ancestorIds && ancestorIds.length) {
    body.ancestor_ids = ancestorIds;
  }
  return this._request("/drive/v1/share/restore", "POST", null, body).then(
    function (resp) {
      if (resp.restore_status === "RESTORE_COMPLETE") {
        return parseTraceIds(resp.params && resp.params.trace_file_ids);
      }
      if (!resp.restore_task_id) {
        throw new Error("转存失败：" + JSON.stringify(resp).slice(0, 200));
      }
      return self.waitTask(resp.restore_task_id).then(parseTraceIds);
    }
  );
};

PikPakClient.prototype.getOwnFile = function (fileId) {
  return this._request("/drive/v1/files/" + fileId, "GET", {
    _magic: "2021",
    usage: "FETCH",
    thumbnail_size: "SIZE_LARGE",
  });
};

// 转存过的文件记在 storage 里，重复解析同一分享时直接复用，不再占用每日转存次数
function restoreCacheKey(shareId, fileId) {
  return "restored:" + shareId + ":" + fileId;
}

function resolveByRestore(client, shareId, items) {
  // 1) 先试缓存
  var pending = [];
  return items
    .reduce(function (p, item) {
      return p.then(function () {
        var ownId = storageGet(restoreCacheKey(shareId, item.id));
        if (!ownId) {
          pending.push(item);
          return;
        }
        return client
          .getOwnFile(ownId)
          .then(function (fi) {
            item.url = fi.trashed ? "" : pickDownloadUrl(fi, client.useTrans);
          })
          .catch(function () {
            item.url = "";
          })
          .then(function () {
            if (!item.url) pending.push(item);
          });
      });
    }, Promise.resolve())
    .then(function () {
      // 2) 其余的按所在目录分组转存（同目录一次请求）
      var groups = {};
      var order = [];
      for (var i = 0; i < pending.length; i++) {
        var key = pending[i].ancestors.join(",");
        if (!groups[key]) {
          groups[key] = [];
          order.push(key);
        }
        groups[key].push(pending[i]);
      }
      return order.reduce(function (p, key) {
        return p.then(function () {
          var group = groups[key];
          var ids = group.map(function (it) {
            return it.id;
          });
          gopeed.logger.info("[pikpak] restoring", ids.length, "files to own drive");
          return client
            .restore(shareId, ids, group[0].ancestors)
            .then(function (trace) {
              return group.reduce(function (p2, item) {
                return p2.then(function () {
                  var ownId = trace[item.id];
                  if (!ownId) return;
                  storageSet(restoreCacheKey(shareId, item.id), ownId);
                  return client.getOwnFile(ownId).then(function (fi) {
                    item.url = pickDownloadUrl(fi, client.useTrans);
                  });
                });
              }, Promise.resolve());
            })
            .catch(function (e) {
              // 一组失败（如每日转存次数用完）不影响其他文件，原因留给最终报错
              client.restoreError = (e && e.message) || String(e);
              gopeed.logger.warn("[pikpak] restore failed:", client.restoreError);
            });
        });
      }, Promise.resolve());
    });
}

// ====== 业务逻辑 ======
function listAllFiles(client, shareId, parentId, pathPrefix, ancestors) {
  // 递归列出所有文件，返回 [{name, path, size, id, ancestors}]
  ancestors = ancestors || [];
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
              ancestors: ancestors,
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
              return listAllFiles(
                client,
                shareId,
                t.folder.id,
                sub,
                ancestors.concat([t.folder.id])
              ).then(function (childFiles) {
                out = out.concat(childFiles);
              });
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

function describeNames(names) {
  var shown = names.slice(0, 3).join("、");
  return names.length > 3 ? shown + " 等 " + names.length + " 个文件" : shown;
}

// 只有 MessageError 会被 Gopeed 展示给用户；普通 Error 或空结果都会让 Gopeed
// 退回成把分享页当普通 HTTP 下载，解析出一个"未知文件"
var UserError = typeof MessageError !== "undefined" ? MessageError : Error;

gopeed.events.onResolve(function (ctx) {
  var settings = gopeed.settings || {};
  var client = new PikPakClient(settings);
  var parsed;
  var loggedIn = false;

  return Promise.resolve()
    .then(function () {
      parsed = parseShareUrl(ctx.req.url);
      gopeed.logger.info(
        "[pikpak] resolve shareId=" + parsed.shareId,
        "initialParentId=" + (parsed.initialParentId || "(none)")
      );
      return client.ensureLogin();
    })
    .then(function (ok) {
      loggedIn = ok;
      gopeed.logger.info(
        "[pikpak] mode=" + (loggedIn ? "login user_id=" + client.userId : "anonymous")
      );
      // 1) pass_code_token 默认空：仅在有密码分享时用密码调 /drive/v1/share 换取
      if (!settings.share_pwd) return "";
      return client
        .getShareInfo(parsed.shareId, settings.share_pwd)
        .then(function (info) {
          return info.pass_code_token || "";
        });
    })
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
      // 2) 逐个取分享内的下载链（匿名时只有视频有）
      return files
        .reduce(function (p, item) {
          return p.then(function () {
            return client.getFileInfo(parsed.shareId, item.id).then(function (info) {
              var fi = info.file_info || info;
              item.url = pickDownloadUrl(fi, client.useTrans);
            });
          });
        }, Promise.resolve())
        .then(function () {
          // 3) 剩下的（zip 等）登录后转存到自己网盘再取下载链
          var noUrl = files.filter(function (it) {
            return !it.url;
          });
          if (!noUrl.length || !loggedIn) return;
          return resolveByRestore(client, parsed.shareId, noUrl);
        })
        .then(function () {
          var resolved = [];
          var missing = [];
          for (var i = 0; i < files.length; i++) {
            var item = files[i];
            if (!item.url) {
              gopeed.logger.warn("[pikpak] no download url for", item.name);
              missing.push(item.name);
              continue;
            }
            resolved.push({
              name: item.name,
              path: item.path || "",
              size: item.size,
              req: {
                url: item.url,
                extra: {
                  header: {
                    "User-Agent": DEFAULT_UA,
                    Referer: "https://mypikpak.com/",
                  },
                },
              },
            });
          }
          if (!resolved.length) {
            throw new Error(
              loggedIn
                ? "已登录，但未能拿到下载地址：" +
                    describeNames(missing) +
                    (client.restoreError ? "（" + client.restoreError + "）" : "")
                : "匿名访问只提供视频的播放地址，" +
                    describeNames(missing) +
                    " 需要登录后才能下载。请在扩展设置中填写 PikPak 账号密码或 refresh_token"
            );
          }
          if (missing.length) {
            gopeed.logger.warn(
              "[pikpak] skipped",
              missing.length,
              "files without download url" +
                (loggedIn ? "" : " (configure login to download them)")
            );
          }
          // Gopeed v1.9.x 要求 name 非空（否则报 invalid resource name 并退回 HTTP 解析）；
          // 单文件时 name 不参与保存路径，用文件名即可
          ctx.res = {
            name: resolved[0].name,
            files: resolved,
          };
          if (resolved.length > 1) {
            // 多文件时给出一个目录名（取分享 ID 末尾若干）
            ctx.res.name = "PikPak-" + parsed.shareId.slice(-10);
          }
          gopeed.logger.info(
            "[pikpak] resolved",
            resolved.length,
            "files"
          );
        });
    })
    .catch(function (e) {
      throw new UserError("PikPak: " + ((e && e.message) || String(e)));
    });
});
