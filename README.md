# gopeed-extension-pikpak

[Gopeed](https://gopeed.com) 的 PikPak 分享解析扩展。把 `https://mypikpak.com/s/<share_id>[/<parent_id>]` 形式的分享链接喂给 Gopeed，自动列出所有文件并解析直链下载。

> **视频可匿名下载；zip 等其他文件需要登录并转存。** PikPak 对分享里的非视频文件不给直链（网页端的“下载”按钮也只是引导你先转存）。登录后，扩展会把这些文件**转存到你自己的 PikPak 网盘**，再取网盘里的下载地址。
>
> - 转存会占用你的网盘空间；免费账号每天的转存次数有限
> - 同一分享里转存过的文件会记住，重复解析不会再次转存（除非你把网盘里那份删了）

## 功能

- 识别 `mypikpak.com` / `mypikpak.net` 上的分享链接
- 自动算 captcha_sign；视频无需账号
- 可选登录（账号密码 / refresh_token），登录态缓存在扩展存储里，过期自动刷新
- 登录后自动转存非视频文件到自己网盘再下载
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

### 命令行调试

不进 Gopeed 也能跑：`test/cli.js` 用 Node 模拟 Gopeed 运行时，设置项走环境变量（`PIKPAK_USERNAME` / `PIKPAK_PASSWORD` / `PIKPAK_REFRESH_TOKEN` / `PIKPAK_SHARE_PWD` 等），扩展存储落在 `test/.storage.json`。

```bash
node test/cli.js https://mypikpak.com/s/<share_id>
```

## 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| `api_host` | `api-drive.mypikpak.com` | PikPak API 域名。某些规则集（如 ChinaMax）会把 `.net` 误判为中国域名走直连，默认用 `.com` 命中率更高 |
| `user_host` | `user.mypikpak.com` | captcha/init 域名 |
| `use_transcoding` | 关闭 | 视频文件是否优先用转码地址 |
| `share_pwd` | 空 | 密码分享时填这里 |
| `username` / `password` | 空 | PikPak 账号密码。若登录被要求人机验证（扩展里无法完成），改用 `refresh_token` |
| `refresh_token` | 空 | 从网页端取得的 refresh_token，见下文 |

注意：Gopeed 设置项是明文保存的。

## 获取 refresh_token

1. 用浏览器**无痕窗口**打开 <https://mypikpak.com/drive> 并登录
2. F12 打开控制台，执行：
   ```js
   JSON.parse(localStorage.getItem("credentials_YUMx5nI8ZU8Ap8pm")).refresh_token
   ```
3. 把输出的字符串填进扩展设置的 `refresh_token`
4. **直接关闭无痕窗口，不要点退出登录**（退出会吊销这个 token）

refresh_token 每次刷新都会轮换，扩展会把新值存在自己的存储里；设置里的值只在你粘贴新 token 时生效。如果提示 refresh_token 已失效，重复上面的步骤即可。

## 网络要求

PikPak 对 IDC IP 段（DigitalOcean/AWS/各类云厂商）有屏蔽。如果直连返回 `share_status: PROHIBITED`，需要给 `mypikpak.com` 配住宅出口的代理（HK/JP/SG 一般可用）：

- **Surge / Quantumult X / Clash** 加分流：
  ```
  DOMAIN-SUFFIX,mypikpak.com,你的代理节点
  DOMAIN-SUFFIX,mypikpak.net,你的代理节点
  ```
- **Gopeed Docker** 容器需要把 HTTP 代理填到 Gopeed 全局设置里（容器流量不会自动走宿主机的系统代理），或在容器层面用 `HTTP_PROXY` 环境变量。

## 实现原理

参考 [alist 的 pikpak_share 驱动](https://github.com/alist-org/alist/tree/main/drivers/pikpak_share)，移植成纯 JS 在 Gopeed 的 goja 运行时里跑：

```
parseShareUrl(URL)
       │
       ▼
captcha/init  (POST user.mypikpak.com)
  body: { captcha_sign = md5_chain(client_id+ver+pkg+device_id+ts, salts...) }
       │  → captcha_token
       ▼
(可选) 登录  POST user.mypikpak.com/v1/auth/signin 或 /v1/auth/token
       │  → access_token（缓存在 gopeed.storage，之后请求带 Authorization）
       ▼
share/detail  (GET api-drive.mypikpak.com)
  query: { share_id, parent_id, pass_code_token, page_token, ... }
       │  → 递归子目录 + 翻页
       ▼
share/file_info (GET api-drive.mypikpak.com)
  query: { share_id, file_id, pass_code_token }
       │  → medias[].link（仅视频有）
       ▼
(登录时，对没有链接的文件) share/restore → tasks/{id} 轮询 → files/{own_id}?usage=FETCH
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
