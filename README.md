# Web AirDrop

基于 WebRTC DataChannel 的浏览器端 AirDrop：多设备加入同一房间后，互相直传文本、图片、音视频等文件。信令与房间由 NestJS 提供，文件内容不经服务器中转。

## 技术栈

- **Monorepo**: pnpm workspaces
- **前端**: React 19 + Vite + TypeScript
- **后端**: NestJS + Fastify + Socket.IO（信令）+ TypeScript
- **共享**: `@airdrop/shared`（事件名、协议类型、房间码）

## 目录

```text
apps/web        React 客户端
apps/server     NestJS 信令 + 网络剪切板 API
packages/shared 共享协议
staticStorage   网络剪切板文件存储（本地，不入库）
```

## 快速开始

需要 Node.js 20+ 与 pnpm 9+。

```bash
pnpm install
pnpm dev      # 开发：web(5173) + server(3000)
pnpm start    # 生产：打包 web/server 后由 Nest 托管 SPA，访问 http://localhost:3000
```

- 开发前端: http://localhost:5173
- 开发后端 / 生产一体: http://localhost:3000
- 网络剪切板: `/`（自动生成 ID，进入 `/{id}`）
- AirDrop: `/airdrop`
- 健康检查: `GET /health`
- 创建房间（REST）: `POST /api/rooms` → `{ "roomId": "XXXXXX" }`
- ICE 配置: `GET /api/ice`

打开两个浏览器窗口（或手机与电脑），一端「创建房间」，另一端输入房间码或扫描二维码/打开链接加入，即可互发文本与文件。

### 网络剪切板

服务端持久化共享板：打开 `/` 得到 ID，另一端打开同一 `/{id}` 即可看到已保存的文本与文件。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/clipboard/:id` | 读取 |
| PUT | `/api/clipboard/:id/text` | 保存文本 |
| DELETE | `/api/clipboard/:id/text` | 清空文本 |
| POST | `/api/clipboard/:id/files` | 上传（multipart 字段 `files`） |
| GET | `/api/clipboard/:id/files/:fileId` | 下载/预览 |
| DELETE | `/api/clipboard/:id/files/:fileId` | 删文件 |
| DELETE | `/api/clipboard/:id` | 整夹清空 |

文件落盘目录：`staticStorage/{id}/`（可用环境变量 `STORAGE_DIR` 覆盖）。

## 环境变量（服务端）

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 服务端口 | `3000` |
| `CORS_ORIGIN` | 允许的前端来源，逗号分隔；不设则反射请求 Origin | 反射 |
| `WEB_DIST` | 前端静态资源目录 | `apps/web/dist` |
| `STUN_URLS` | STUN 地址，逗号分隔 | `stun:stun.l.google.com:19302` |
| `TURN_URLS` | 可选 TURN，逗号分隔 | 空 |
| `TURN_USERNAME` | TURN 用户名 | 空 |
| `TURN_CREDENTIAL` | TURN 密码 | 空 |
| `STORAGE_DIR` | 网络剪切板存储根目录 | 仓库根下 `staticStorage` |
| `FILE_MAX_BYTES` | 剪切板单文件大小上限（字节） | `104857600`（100MB） |

跨公网/复杂 NAT 时建议配置自建 coturn，否则部分网络无法建立 P2P。

## 脚本

```bash
pnpm dev          # 并行启动 shared watch + server + web
pnpm build        # 构建全部包
pnpm dev:server   # 仅后端
pnpm dev:web      # 仅前端
```

## 工作原理

1. 设备通过 Socket.IO 创建/加入房间，获取 peer 列表。
2. 新加入方对房内已有成员发起 WebRTC offer（mesh）。
3. SDP / ICE 经服务器转发；媒体与文件走 RTCDataChannel。
4. 文本为 JSON 控制消息；文件为 meta + 16KB 二进制分片 + done/ack。

## 验收建议

1. 两台设备同一房间互发文本，即时可见。
2. 发送图片可预览；音视频可播放并可下载。
3. 第三台加入后，与前两台均可互传。
4. 服务端仅见信令日志，无文件二进制落盘。
