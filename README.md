# gopeed-extension-pikpak

[Gopeed](https://gopeed.com) 的 PikPak 分享解析扩展。无需登录账号，把 `https://mypikpak.com/s/<share_id>[/<parent_id>]` 形式的分享链接喂给 Gopeed，自动列出所有文件并解析直链下载。

## 功能

- 识别 `mypikpak.com` / `mypikpak.net` 上的分享链接
- 自动算 captcha_sign，无需账号
- 递归遍历子目录 + 自动翻页
- 单文件 / 多文件 / 嵌套目录都保留原始结构
- 支持密码型分享（在扩展设置里填密码）
- 视频可选转码地址（清晰度低但更稳）

## 安装

### 通过 Gopeed Scheme（推荐）

打开下面这个链接（桌面端 Gopeed 已运行时）：

```
gopeed://install/https%3A%2F%2Fgithub.com%2FTeamBreakerr%2Fgopeed-extension-pikpak
```

或在 Gopeed 扩展页粘贴：`https://github.com/TeamBreakerr/gopeed-extension-pikpak`

### 本地开发模式

1. 在 Gopeed 扩展页连续点击安装按钮 5 次开启开发者模式
2. 点目录选择按钮，选中本仓库目录
3. 创建任务时贴 PikPak 分享链接即可

## 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| `api_host` | `api-drive.mypikpak.com` | PikPak API 域名。某些规则集（如 ChinaMax）会把 `.net` 误判为中国域名走直连，默认用 `.com` 命中率更高 |
| `user_host` | `user.mypikpak.com` | captcha/init 域名 |
| `use_transcoding` | 关闭 | 视频文件是否优先用转码地址 |
| `share_pwd` | 空 | 密码分享时填这里 |

## 网络要求

PikPak 对 IDC IP 段（DigitalOcean/AWS/各类云厂商）有屏蔽。如果直连返回 `share_status: PROHIBITED`，需要给 `mypikpak.com` 配住宅出口的代理（HK/JP/SG 一般可用）：

- **Surge / Quantumult X / Clash** 加分流：
  ```
  DOMAIN-SUFFIX,mypikpak.com,你的代理节点
  DOMAIN-SUFFIX,mypikpak.net,你的代理节点
  ```
- **Gopeed Docker** 容器需要把 HTTP 代理填到 Gopeed 全局设置里（容器流量不会自动走宿主机的系统代理），或在容器层面用 `HTTP_PROXY` 环境变量。

## 实现原理

### 大型分享与网络错误（1.0.1）

解析时先递归列出文件，再串行获取每个文件的下载地址；大量文件可能需要数分钟。
网络错误、30 秒请求超时、HTTP 408/429/5xx 会自动重试，每个请求最多尝试 5 次，
重试间隔为 1、2、4、8 秒。服务器的 `Retry-After` 会被遵守；超过 60 秒则提示稍后再试。
密码错误、其他 HTTP 错误等不会盲目重试。

每完成 10 个文件，扩展日志会输出 `[pikpak] progress 已完成数/总数`。
重试日志只记录接口地址（不含查询参数）、状态与等待时间，不记录密码、令牌或下载直链。
Gopeed 的日志目录中可找到 `extension.log`；部分 Windows 安装位于安装目录的 `storage/logs`。

只有全部文件解析完成才返回文件列表。重试耗尽或缺少下载地址时，通过 Gopeed 的
`MessageError` 显示具体失败阶段/文件序号，避免静默回退成“分享 ID、未知大小”的普通 HTTP 文件。
此修复可缓解短暂连接故障，但不能绕过持续的网络阻断或分享访问限制。

开发验证：`node --test tests/resolve.test.cjs`（测试不访问网络）。

参考 [alist 的 pikpak_share 驱动](https://github.com/alist-org/alist/tree/main/drivers/pikpak_share)，移植成纯 JS 在 Gopeed 的 goja 运行时里跑：

```
parseShareUrl(URL)
       │
       ▼
captcha/init  (POST user.mypikpak.com)
  body: { captcha_sign = md5_chain(client_id+ver+pkg+device_id+ts, salts...) }
       │  → captcha_token
       ▼
share/detail  (GET api-drive.mypikpak.com)
  query: { share_id, parent_id, pass_code_token, page_token, ... }
       │  → 递归子目录 + 翻页
       ▼
share/file_info (GET api-drive.mypikpak.com)
  query: { share_id, file_id, pass_code_token }
       │  → web_content_link
       ▼
ctx.res = { name, files: [{ name, path, size, req: { url, extra.header } }] }
```

## License

MIT

## 致谢

- [alist](https://github.com/alist-org/alist) — PikPak 分享 API 与签名算法
- [Gopeed](https://gopeed.com) — 优秀的开源下载器和扩展生态
- [Joseph Myers' MD5](https://www.myersdaily.org/joseph/javascript/md5-text.html) — goja 运行时下的 MD5 实现
