# nest-cj 项目长期备忘（LinguaFlow 英语学习平台）

## 项目定位
按用户简历描述 1:1 落地的可运行项目（面试可演示）。Monorepo：`apps/web`（Vue3 用户端+管理端，4173 preview / 5173 dev）、`apps/server`（NestJS+Prisma+MySQL，8080）、`apps/ai-service`（LangGraph ReAct Agent，8090）、`packages/shared`（CJS+ESM 双产物）。

## 启动方式
1. 导入 `sql/english_platform.sql`（20 表+种子数据，phpMyAdmin 可直接导）
2. `npm install && npm run build:shared`
3. 三个服务：`npm run dev:server` / `dev:ai` / `dev:web`

## 自测脚本（改完必须跑）
- `node scripts/smoke-test.mjs` —— 后端 56 项断言
- `node scripts/ai-smoke.mjs` —— AI 服务 9 项
- `node scripts/verify-web.mjs` —— 前端 15 页截图+运行时报错（需先 build+preview，不能对 dev server 跑）
- `node scripts/e2e-chat.mjs` —— 端到端 SSE
- `node scripts/ws-smoke.mjs` —— WebSocket 链路（握手路径/代理/鉴权/升级）

## 部署（宝塔 / 无 Docker）
- 手册：`docs/deploy-baota.md`；PM2 用 `deploy/ecosystem.config.cjs`；nginx 用 `deploy/nginx-linguaflow.conf`；更新用 `scripts/deploy-baota.sh`
- 端口规划：主服务 **8090**、AI 服务 **8091**（用户服务器 8080 已被 kings-match 后端占用）
- PM2 必须 fork + instances:1（主服务带 @nestjs/schedule 定时任务，cluster 会重复执行）
- PM2 的 cwd 必须指向各 app 目录（NestJS ConfigModule 读 cwd 下的 .env）
- nginx 三个必须项：`/api/` 加 `proxy_buffering off`（SSE 流式不关缓冲会退化成一次性输出）；代理 `/socket.io/` 带 Upgrade 头；`proxy_pass` 结尾不加斜杠
- Prisma Client 必须在目标服务器上 `prisma generate`（engine 二进制分平台，跨系统拷贝报 could not be found）

## 关键技术事实
- **Socket.IO 的 `/ws` 是 namespace，握手/升级走 engine.io 默认路径 `/socket.io/`** —— 代理必须配 `/socket.io/`（vite proxy 与 nginx 同理），配 `/ws` 等于代理空气
- 共享包 tsbuildinfo 与 dist 不同步时 tsc 会静默跳过 emit，`scripts/build-shared.mjs` 已处理
- DTO 必须显式声明所有被读取字段（全局 ValidationPipe whitelist:true 会剥离未声明字段）
- 前端 token 按 url 前缀 `/admin` 区分 `elp_token` / `elp_admin_token`
- vite build 与 vite preview 不可同时跑（Windows 文件句柄导致 build 挂死）
- 默认账号：admin/admin123、demo@linguaflow.com 或 demo / 123456
