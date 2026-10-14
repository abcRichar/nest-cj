# LinguaFlow · 全栈英语学习平台

基于 **Monorepo + 多应用架构** 搭建的全栈英语学习平台，包含 Web 前端（用户端 + 管理端）、
主业务服务、独立 AI 服务三个应用，以及一个共享 TypeScript 类型包。

```
┌────────────────┐   HTTP / SSE / WebSocket   ┌──────────────────┐
│  apps/web      │ ─────────────────────────► │  apps/server     │
│  Vue3 用户端    │                            │  NestJS 主业务    │
│  + 管理端       │ ◄───────────────────────── │  + Prisma/MySQL  │
└────────────────┘   支付结果 / 系统通知推送     └────────┬─────────┘
                                                       │ 内部 HTTP + SSE
                                                       ▼
                                              ┌──────────────────┐
                                              │  apps/ai-service │
                                              │  LangGraph Agent │
                                              │  + MySQL Checkpoint│
                                              └──────────────────┘
```

---

## 一、技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue3 · Vue Router · Pinia · Element Plus · TailwindCSS · Socket.IO Client · SSE · Three.js · ECharts |
| 后端 | NestJS · Prisma · MySQL · JWT · Socket.IO · 支付宝 SDK · MinIO · Nodemailer · @nestjs/schedule |
| AI | LangChain · LangGraph（ReAct Agent + Checkpoint）· DeepSeek |
| 工程 | Monorepo（npm workspaces）· 共享类型包 · TypeScript 全链路 · Swagger |

---

## 二、目录结构

```
nest-cj/
├── package.json                # 工作区根配置（npm workspaces）
├── tsconfig.base.json          # 全仓统一 TS 编译配置
├── sql/
│   └── english_platform.sql    # ★ 建表 + 初始数据，可直接在 phpMyAdmin 导入
├── packages/
│   └── shared/                 # ★ 前后端共享的枚举 / 类型 / 工具函数
│       └── src/{constants,types,utils}.ts
└── apps/
    ├── server/                 # 主业务服务（8080）
    │   ├── prisma/schema.prisma
    │   ├── prisma/seed.ts
    │   └── src/
    │       ├── common/         # 全局守卫 / 拦截器 / 异常过滤 / 签名校验
    │       ├── config/
    │       └── modules/
    │           ├── auth/       # 注册登录、JWT、双端 scope
    │           ├── user/       # 用户 + 管理端用户管理
    │           ├── course/     # 课程 / 章节 / 课时
    │           ├── word/       # 单词本 + 艾宾浩斯复习
    │           ├── study/      # 学习进度与统计
    │           ├── order/      # 订单 + 支付宝支付 + 异步回调
    │           ├── storage/    # MinIO 对象存储（分片 / 断点续传 / 秒传）
    │           ├── mail/       # 邮件（学习日报）
    │           ├── schedule/   # 定时任务 + 学习日报
    │           ├── chat/       # AI 对话（SSE 转发 + 会话持久化）
    │           ├── gateway/    # Socket.IO 网关
    │           ├── notice/     # 通知公告
    │           ├── dashboard/  # 管理端数据看板
    │           └── ai/         # AI 服务内部客户端
    ├── ai-service/             # 独立 AI 服务（8090）
    │   └── src/
    │       ├── modules/llm/        # DeepSeek（OpenAI 兼容）
    │       ├── modules/agent/      # LangGraph StateGraph 手写 ReAct 循环
    │       ├── modules/tools/      # 联网搜索工具
    │       ├── modules/checkpoint/ # ★ LangGraph Checkpoint 的 MySQL 实现
    │       ├── modules/chat/       # SSE 流式输出
    │       └── modules/report/     # 学习日报文案生成
    └── web/                    # Web 前端（5173）
        └── src/
            ├── api/            # 接口封装 + 请求拦截 + HMAC 签名
            ├── stores/         # Pinia（用户端 / 管理端双会话）
            ├── router/         # 用户端 + 管理端路由与守卫
            ├── layouts/        # UserLayout / AdminLayout
            ├── utils/          # socket / sse / format
            ├── components/     # ThreeHero / CourseCard / MeNav
            └── views/
                ├── Home.vue  Login.vue  Register.vue
                ├── course/   课程列表 / 详情 / 播放器
                ├── word/     单词本 / 复习
                ├── chat/     AI 对话（流式）
                ├── user/     个人中心 / 我的课程 / 订单 / 日报
                ├── payment/  支付结果
                └── admin/    看板 / 用户 / 课程 / 订单 / AI 角色 / 文件 / 日报 / 公告
```

---

## 三、快速开始

### 1. 准备数据库

在 MySQL 中新建库并导入脚本（二选一）：

```bash
# 方式 A：命令行
mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS english_platform DEFAULT CHARSET utf8mb4;"
mysql -uroot -p english_platform < sql/english_platform.sql
```

> 方式 B：打开 **宝塔 / phpMyAdmin → 新建库 `english_platform`（utf8mb4）→ 导入 → 选择 `sql/english_platform.sql`**

### 2. 配置环境变量

```bash
cp apps/server/.env.example     apps/server/.env      # 改 DATABASE_URL
cp apps/ai-service/.env.example apps/ai-service/.env  # 改 DATABASE_URL、按需填 DEEPSEEK_API_KEY
cp apps/web/.env.example        apps/web/.env
```

### 3. 安装依赖 & 构建共享包

```bash
npm install
npm run build:shared        # 共享类型包必须先构建一次
```

### 4. 启动三个服务（各开一个终端）

```bash
npm run dev:server          # http://localhost:8080/api      接口文档 /api/docs
npm run dev:ai              # http://localhost:8090/api/ai/health
npm run dev:web             # http://localhost:5173
```

### 5. 默认账号

| 端 | 账号 | 密码 |
| --- | --- | --- |
| 用户端 | `demo` | `123456` |
| 管理端 | `admin` | `admin123` |

管理端入口：<http://localhost:5173/admin/login>

---

## 四、核心实现说明

### 1. Monorepo 与共享类型

`packages/shared` 定义了全部枚举（订单状态、课程难度、AI 流式事件…）、实体类型与工具函数，
被前端、主业务服务、AI 服务共同依赖。改动一处类型，两端同时生效，
避免"后端返回 `PAID`、前端判断 `paid`"这类字段不一致问题。

### 2. AI 对话：LangGraph ReAct Agent + MySQL Checkpoint

- **ReAct 循环**：用 `StateGraph` 手写 `agent → tools → agent` 循环，而不是直接调用封装好的
  `createReactAgent`，每一跳（思考 / 行动 / 观察）都可见，前端会把工具调用轨迹渲染出来。
- **会话状态持久化**：自定义 `MysqlSaver extends BaseCheckpointSaver`，把 checkpoint、
  channel blobs、pending writes 落到 `checkpoints` / `checkpoint_blobs` / `checkpoint_writes`
  三张表（与 LangGraph 官方 PostgresSaver 表结构对齐），服务重启后可继续对话。
- **会话隔离**：`thread_id = conv-{conversationId}`，每个会话一条独立的状态链。
- **上下文窗口控制**：进模型前裁剪最近 20 条消息，控制 token 成本。
- **联网搜索**：`web_search` 工具优先走 Tavily，未配置时降级到 DuckDuckGo 免密钥通道。
- **流式输出**：AI 服务用 `streamEvents` 产出 `delta / tool / usage` 事件，通过 SSE 推给主业务服务，
  主业务服务一边转发给浏览器一边累积全文，流结束后落库。

### 3. SSE 流式对话为什么不只用 EventSource

`EventSource` 只支持 GET、不能带 `Authorization` 头、无法中途取消。
所以前端用 `fetch + ReadableStream + AbortController` 手动解析 SSE 帧，
可以带 JWT、可以 POST JSON、可以点"停止生成"。

### 4. 支付闭环

```
下单 → 生成订单(PENDING) → 支付宝支付表单
     → 用户支付 → 支付宝异步回调 notify（验签 + 金额校验 + 幂等）
     → 订单置 PAID + 发放课程权限 + 销量+1
     → Socket.IO 推送 payment:result 到 user:{id} 房间
     → 前端收推送，进度条换成"开始学习"
```

未配置支付宝密钥时自动启用 **Mock 收银台**：后端返回一个本地 HTML 页面，
点"确认支付"即向 notify 接口发一份模拟回调，可在本地完整跑通整条链路。
前端还有 `POST /orders/:orderNo/sync` 主动查询兜底。

### 5. 接口安全

- 全站 `JwtAuthGuard`：校验签名、过期时间、token 作用域（用户端 `/user`、管理端 `/admin` 不能混用）、角色。
- `@SignedApi()` 标记的关键接口（下单、改密）额外走 HMAC-SHA256 签名校验：
  前端把 `METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY` 用密钥签名放进 `x-sign` 头，
  后端 `SignGuard` 验签 + 5 分钟防重放窗口 + nonce 去重。
- 敏感字段（手机号）用 AES-256-CBC 加密落库，同时存 md5 用于等值检索。

### 6. 文件存储：分片 / 断点续传 / 秒传

1. 前端算整文件 SHA-256 → `POST /files/init`
2. 后端查库：命中 `hash + size` 且状态为 COMPLETED → **秒传**，直接返回 URL
3. 未命中：返回已上传分片列表（从对象存储 `tmp/{hash}/` 前缀扫描得到）→ **断点续传**
4. 前端只补缺口分片 → `POST /files/:id/chunk`
5. `POST /files/:id/complete`：按序下载分片、合并、写入正式对象、清理临时分片

MinIO 连不上时自动降级为本地磁盘驱动（`./storage`），保证本地开发不被中间件卡住。

### 7. 学习数据自动化

`@nestjs/schedule` 定时任务：

| 任务 | 频率 | 说明 |
| --- | --- | --- |
| 学习日报 | 每天 21:00 | 聚合当日学习数据 → AI 生成日报文案 → 落库 → Nodemailer 发信 → WebSocket 提醒 |
| 关闭超时订单 | 每 10 分钟 | 30 分钟未支付的订单自动置为已取消 |
| 单词复习提醒 | 每小时 | 待复习 ≥5 个时向在线用户推送提醒 |

---

## 五、自测与验收

仓库内置三个脚本，用来验证「跑起来的东西真的对」，而不是只看编译是否通过。

```bash
# 1) 主业务服务：56 项接口断言（认证/守卫/课程/单词/进度/订单支付/SSE/存储/管理端/越权）
node scripts/smoke-test.mjs

# 2) AI 服务：健康检查 + 内部令牌鉴权 + SSE 流式事件 + 日报生成闭环
node scripts/ai-smoke.mjs

# 3) 前端页面：Chrome headless + CDP，逐页截图并抓运行时报错 / 断言 DOM 契约
node scripts/verify-web.mjs

# 4) WebSocket 链路：握手路径 / 代理转发 / JWT 鉴权 / websocket 升级
node scripts/ws-smoke.mjs
```

`verify-web.mjs` 会启动无头 Chrome，遍历用户端与管理端 15 个页面，
每页做三件事：截全页图、收集 `Runtime.exceptionThrown` / `console.error`、
用 `Runtime.evaluate` 检查正文长度、表格数、canvas 数、是否有错误 toast。
截图落在 `.tmp/shots/`，可以直接目检渲染效果。

> 脚本需要服务已启动；`smoke-test.mjs` 支持 `SMOKE_BASE` / `SMOKE_USER` / `SMOKE_ADMIN` 等环境变量覆盖默认值。

---

## 六、常用命令

```bash
npm run build:shared        # 构建共享类型包
npm run build               # 全量构建（shared → server → ai → web）
npm run dev:server          # 启动主业务服务（watch）
npm run dev:ai              # 启动 AI 服务（watch）
npm run dev:web             # 启动前端
npm run prisma:generate     # 生成 Prisma Client
npm run prisma:push         # 按 schema 同步表结构（不想手动导 SQL 时可用）
npm run db:seed             # 初始化数据（等价于 SQL 里的初始数据）
```

---

## 六、说明

- `sql/english_platform.sql` 与 `apps/server/prisma/schema.prisma` 结构完全一致，二者选其一即可。
  手动导入 SQL 后，仍建议执行一次 `npm run prisma:generate` 生成客户端。
- 所有第三方密钥（支付宝、DeepSeek、SMTP、MinIO、Tavily）缺失时都有降级路径，
  项目可以零配置启动并演示完整业务流程。
