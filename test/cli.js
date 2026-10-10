#!/usr/bin/env node
/**
 * 在 Node 里模拟 Gopeed 运行 index.js 的 onResolve，便于脱离 Gopeed 调试。
 *
 *   node test/cli.js <分享链接>
 *
 * 设置项通过环境变量传入（对应 manifest.json 里的 settings）：
 *   PIKPAK_USERNAME / PIKPAK_PASSWORD / PIKPAK_REFRESH_TOKEN / PIKPAK_SHARE_PWD
 *   PIKPAK_API_HOST / PIKPAK_USER_HOST / PIKPAK_USE_TRANSCODING
 * gopeed.storage 持久化到 test/.storage.json（已 gitignore，内含 token）。
 */
var fs = require("fs");
var path = require("path");

var url = process.argv[2];
if (!url) {
  console.error("usage: node test/cli.js <share url>");
  process.exit(2);
}

var storageFile =
  process.env.PIKPAK_STORAGE_FILE || path.join(__dirname, ".storage.json");
function loadStorage() {
  try {
    return JSON.parse(fs.readFileSync(storageFile, "utf8"));
  } catch (e) {
    return {};
  }
}

function MessageError(message) {
  this.message = message;
}

var env = process.env;
var handler;
global.MessageError = MessageError;
global.gopeed = {
  settings: {
    api_host: env.PIKPAK_API_HOST || "api-drive.mypikpak.com",
    user_host: env.PIKPAK_USER_HOST || "user.mypikpak.com",
    use_transcoding: env.PIKPAK_USE_TRANSCODING || "0",
    share_pwd: env.PIKPAK_SHARE_PWD || "",
    username: env.PIKPAK_USERNAME || "",
    password: env.PIKPAK_PASSWORD || "",
    refresh_token: env.PIKPAK_REFRESH_TOKEN || "",
  },
  logger: {
    debug: function () {},
    info: console.log.bind(console, "INF"),
    warn: console.log.bind(console, "WRN"),
    error: console.log.bind(console, "ERR"),
  },
  storage: {
    get: function (k) {
      var v = loadStorage()[k];
      return v === undefined ? null : v;
    },
    set: function (k, v) {
      var s = loadStorage();
      s[k] = String(v);
      fs.writeFileSync(storageFile, JSON.stringify(s, null, 2), { mode: 0o600 });
    },
  },
  events: {
    onResolve: function (fn) {
      handler = fn;
    },
  },
};

require(path.join(__dirname, "..", "index.js"));

var ctx = { req: { url: url } };
Promise.resolve(handler(ctx)).then(
  function () {
    var res = ctx.res;
    // 与 Gopeed v1.9.x 的 Resource.Validate 一致，不通过时 Gopeed 会退回 HTTP 解析
    var invalid = !res || !res.name
      ? "invalid resource name"
      : !res.files.length
        ? "invalid resource files"
        : res.files.some(function (f) { return !f.name; })
          ? "invalid resource file name"
          : "";
    if (invalid) {
      console.log("\nFAIL Gopeed would reject the result: " + invalid);
      process.exitCode = 1;
      return;
    }
    console.log("\nOK name=" + JSON.stringify(res.name), "files=" + res.files.length);
    res.files.forEach(function (f) {
      console.log(
        "-",
        (f.path ? f.path + "/" : "") + f.name,
        f.size,
        "bytes\n ",
        f.req.url.slice(0, 100) + (f.req.url.length > 100 ? "..." : "")
      );
    });
  },
  function (e) {
    var kind = e instanceof MessageError ? "MessageError" : "Error(not shown in Gopeed UI!)";
    console.log("\nFAIL " + kind + ": " + (e && e.message));
    process.exitCode = 1;
  }
);
