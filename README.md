# 移动端二维码扫描

Vue 3 + TypeScript + Vite 前端使用 jsQR 在本机每约一秒识别一次摄像头画面；仅当有效 HTTP(S) URL 与上次触发发送的原始字符串不同时，向 Express 发送一次 POST。失败不自动重试，停止或暂时扫不到二维码也不会清空上次结果；刷新页面会重置。页面切入后台时释放摄像头，返回前台时尝试恢复，若浏览器阻止恢复则点击开始重试。

## 运行

需要 Node.js 20.19+ 或 22.12+ 与 npm。在项目根目录：

```sh
npm install
npm run dev:backend
```

另开终端：

```sh
npm run dev:frontend
```

Vite 监听 5173，Express 监听 3000。Vite 将 `/api` 代理到本机 Express；前端使用相对路径。电脑本机可访问 http://localhost:5173。

## 手机 HTTPS 测试

手机通过局域网 IP 访问普通 HTTP 页面通常不能调用摄像头（手机上的 localhost 指手机自己）。一种可操作的方式是使用 HTTPS 隧道，例如安装并登录 Cloudflare Tunnel 的 `cloudflared` 后，在上述两个服务运行期间执行：

```sh
cloudflared tunnel --url http://localhost:5173
```

在手机上打开命令输出的 `https://...trycloudflare.com` 地址，允许摄像头权限。隧道会把页面和 `/api` 一同转发至 Vite，后者再代理到 Express；不要在手机上直接访问 3000 端口。临时隧道依赖网络和服务可用性，请勿将敏感内容暴露到公共网络。也可使用受手机信任的局域网证书和 HTTPS 反向代理。

用两个不同的 HTTP(S) 二维码按 A、A、移开、A、B、A 的顺序测试，后端应依次输出 A、B、A。停止后检查摄像头指示灯；可关闭后端验证发送失败后扫描仍继续。iOS Safari 和 Android Chrome 需在真实设备上分别测试摄像头、后台切换及权限。

## 生产运行

```sh
npm run build
npm start
```

Express 从 `frontend/dist` 提供静态页面及同源 `/api/qrcode`；`PORT` 环境变量可更改默认的 3000 端口。生产部署应在可信 HTTPS 反向代理之后提供同一域名的页面和 API。服务本身是 HTTP，不自行终止 TLS。

## 验证

```sh
npm test
npm run build
```
