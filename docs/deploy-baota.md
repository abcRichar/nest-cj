# LinguaFlow 宝塔部署手册

> 适用形态：Monorepo 里 3 个可运行应用（Vue3 前端 / NestJS 主服务 / NestJS AI 服务）+ 1 个 MySQL。
> 无 Docker，纯「Node 进程 + nginx 反代」部署。

---

## 一、部署后的样子

| 组件 | 运行形态 | 监听 | 对公网暴露 |
|---|---|---|---|
| `apps/web` | 静态文件（`vite build` 产物） | — | 由 nginx 直接返回 |
| `apps/server` | PM2 守护的 Node 进程 | `127.0.0.1:8090` | 否，只经 nginx `/api/` `/socket.io/` `/static/` |
| `apps/ai-service` | PM2 守护的 Node 进程 | `127.0.0.1:8091` | **完全不对公网**，只被主服务内网调用 |
| MySQL | 宝塔数据库 | `3306` | 否 |
| nginx | 宝塔站点 | `80 / 443` | 是 |

请求链路：浏览器 → nginx（80/443）→ `/api` 打到主服务 → 主服务按需再调 AI 服务。
**前端全程用相对路径 `/api`，所以同源部署后不存在跨域问题。**

```
浏览器
  │  https://your-domain.com          ├── /                → apps/web/dist（SPA）
  ▼                                   ├── /api/            → 127.0.0.1:8090
nginx (80/443) ────────────────────────┼── /socket.io/      → 127.0.0.1:8090（WebSocket 升级）
                                       └── /static/         → 127.0.0.1:8090
                                              │
                     apps/server (8090) ──────┴──> apps/ai-service (8091)  [仅内网]
                              │                          │
                              └────── MySQL 3306 ────────┘
```

---

## 二、端口先规划好（这台服务器特别重要）

你服务器上 **8080 已经被 kings-match 后端占了**，CMS 那套也在用别的端口，所以新项目另起两个干净端口：

| 服务 | 端口 |
|---|---|
| kings-match 后端 | 8080（已占用，别碰） |
| **本项目主服务** | **8090** |
| **本项目 AI 服务** | **8091** |

动手前先确认没冲突：

```bash
ss -lntp | grep -E ':8090|:8091'      # 有输出说明被占了，换端口
ps aux | grep -E 'java|node' | grep -v grep
```

> ⚠️ 宝塔新建站点时，**监听端口填 80 或 443，不要填 8090**。
> 站点配了 8090 就等于让 nginx 抢占后端端口，后端起不来，同时 `/api` 会被当静态文件找，
> 报 `open() "/www/wwwroot/xxx/api/..." failed (2: No such file or directory)`。这个坑你踩过两次了。

---

## 三、部署步骤

### 1. 装 Node 与 PM2

宝塔面板 → 软件商店 → 搜「PM2管理器」（顺带会装 Node），或：

```bash
# 已有 Node 的话直接确认版本，项目要求 >= 18
node -v && npm -v

npm i -g pm2
pm2 -v
```

### 2. 上传代码

推荐 git（更新方便）：

```bash
mkdir -p /www/wwwroot/linguaflow && cd /www/wwwroot/linguaflow
git clone <你的仓库地址> .
```

或者用宝塔文件管理器上传 zip 再解压。**传之前本地先清掉 `node_modules`、`dist`、`apps/*/dist`**，在服务器上重新装，避免平台差异。

### 3. 建库 + 导 SQL

1. 宝塔 → 数据库 → 添加数据库：
   - 库名 `english_platform`，字符集 **utf8mb4**
   - 记下用户名和密码（建议单独建库用户，别直接用 root）
2. 导入表结构与种子数据：把 `sql/english_platform.sql` 拖进宝塔 → 数据库 → 管理（phpMyAdmin）→ 导入。

> 你已经习惯在 phpMyAdmin 里一条条粘 SQL，这个文件是一次性的完整脚本，**整个文件导入一次**即可，不用拆开执行。

命令行方式（更省事）：

```bash
mysql -h127.0.0.1 -uroot -p english_platform < /www/wwwroot/linguaflow/sql/english_platform.sql
```

3. 验证：

```bash
mysql -h127.0.0.1 -uroot -p -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='english_platform';"
# 应该看到 20 张表
```

### 4. 写配置文件（两个服务各一份）

**`apps/server/.env`**

```ini
NODE_ENV=production
APP_NAME=elp-server
PORT=8090
API_PREFIX=/api

# 数据库（宝塔建的那个库）
DATABASE_URL="mysql://english_platform:你的库密码@127.0.0.1:3306/english_platform"

# 生产环境务必换掉
JWT_SECRET=换成随机长字符串
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ★ 必须和前端 apps/web/.env 里的 VITE_SIGN_KEY 完全一致，否则创建订单等接口全 400
SIGN_KEY=换成随机字符串

# 同源反代后其实用不到 CORS，填上域名更稳
CORS_ORIGIN=https://your-domain.com

# AI 服务（内网）
AI_SERVICE_URL=http://127.0.0.1:8091
AI_SERVICE_TOKEN=换成随机字符串

# 支付宝（沙箱或正式；不填 APP_ID 会走 Mock 模式，方便先跑通流程）
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do
ALIPAY_NOTIFY_URL=https://your-domain.com/api/payment/alipay/notify
ALIPAY_RETURN_URL=https://your-domain.com/payment/result

# MinIO：服务器不装 MinIO 就保持默认，系统会自动降级为本地磁盘存储（apps/server/storage）
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=english-platform
MINIO_PUBLIC_URL=https://your-domain.com/static

# 邮件：不配的话学习日报只落库不发信（不会报错）
MAIL_HOST=smtp.qq.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=你的邮箱@qq.com
MAIL_PASS=SMTP授权码
MAIL_FROM="英语学习平台 <你的邮箱@qq.com>"

# 定时任务：每晚 21:00 生成日报 + 关超时订单 + 单词复习提醒
DAILY_REPORT_CRON=0 0 21 * * *
ENABLE_SCHEDULE=true

FRONTEND_URL=https://your-domain.com
```

**`apps/ai-service/.env`**

```ini
NODE_ENV=production
PORT=8091
API_PREFIX=/api

# ★ 必须和主服务的 AI_SERVICE_TOKEN 一致，否则主服务调 AI 全 401
INTERNAL_TOKEN=和上面 AI_SERVICE_TOKEN 填同一个值

# DeepSeek 真模型；留空则走演示模式（流式效果真实，文案是模拟的）
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TEMPERATURE=0.7
DEEPSEEK_MAX_TOKENS=2048

# LangGraph checkpoint 会话状态就存在这个库里
DATABASE_URL="mysql://english_platform:你的库密码@127.0.0.1:3306/english_platform"

# 联网搜索工具（不填则 search 工具返回空结果，Agent 仍可运行）
TAVILY_API_KEY=
SEARCH_MAX_RESULTS=5
AGENT_MAX_ITERATIONS=8
```

**`apps/web/.env`**（注意：`VITE_*` 是**构建期**注入，改完必须重新 build）

```ini
# 仅 dev / preview 用，生产构建时用不到
VITE_API_TARGET=http://127.0.0.1:8090

# ★ 必须是相对路径，这样请求才会走 nginx 反代
VITE_API_BASE=/api

VITE_APP_TITLE=LinguaFlow
VITE_SIGN_KEY=和 server 的 SIGN_KEY 填同一个值
```

### 5. 装依赖并构建

```bash
cd /www/wwwroot/linguaflow

# 小内存机器（<2G）先加上，否则 vite 打包可能被 OOM 杀掉
export NODE_OPTIONS=--max-old-space-size=2048

npm install --no-audit --no-fund     # Monorepo 根目录一次装齐所有子包

npm run prisma:generate              # ★ 见下方说明，必须在服务器上跑
npm run build                        # 顺序：shared -> server -> ai -> web
```

> ★ **Prisma 这一步不能省，也不能把本地生成的产物传上来。**
> Prisma 的 query engine 是平台相关的二进制文件，Windows 上生成的拿到 Linux 上会直接报
> `Query engine binary for current platform "debian-openssl-3.0.x" could not be found`。
> 必须在服务器上执行 `npm run prisma:generate`。
> 如果报 openssl 相关错误：`yum install -y openssl` 或 `apt install -y openssl`。

构建成功的标志：`apps/server/dist/main.js`、`apps/ai-service/dist/main.js`、`apps/web/dist/index.html` 都存在。

### 6. 用 PM2 起两个后端

```bash
cd /www/wwwroot/linguaflow
mkdir -p logs

pm2 start deploy/ecosystem.config.cjs
pm2 save                          # 保存进程列表
pm2 startup                       # 按提示执行它输出的那行命令，实现开机自启

pm2 list
pm2 logs linguaflow-server --lines 50
```

配置文件里 `cwd` 已分别指向 `apps/server` 和 `apps/ai-service` —— **这一步不能改**，因为 NestJS 读的是「当前工作目录」下的 `.env`，cwd 写错会导致配置全部走默认值（连不上数据库、装成连本机 8090 的 AI 地址）。

健康检查：

```bash
curl http://127.0.0.1:8090/api/health       # {"code":0,...,"status":"UP"}
curl http://127.0.0.1:8091/api/ai/health    # AI 服务
```

### 7. 配 nginx 站点

1. 宝塔 → 网站 → 添加站点：域名填你的域名，**不要选 PHP 版本、不要建数据库、端口留 80**。
2. 进入站点设置 → 配置文件，把 `deploy/nginx-linguaflow.conf` 的内容贴进去（**保留宝塔原有的 `#SSL-START / #SSL-END` 段**），把里面的 `your-domain.com` 和端口替换成实际值。
3. 站点根目录改成 `/www/wwwroot/linguaflow/apps/web/dist`。
4. **伪静态设为「无」**，因为 SPA 回退已写在配置里的 `try_files $uri $uri/ /index.html`，两处都配会打架。
5. 让配置生效：

```bash
# ⚠️ 你这台机器上 nginx -s reload 会静默失效（两套 nginx 并存，pid 文件对不上）
#    必须用 HUP 信号，或者直接在宝塔面板点「重启 Nginx」
kill -HUP $(cat /www/server/nginx/logs/nginx.pid)

# 验证真的生效了：看 worker 的启动时间有没有变
ps -o pid,lstart,cmd -C nginx
```

### 8. HTTPS 与支付宝回调

- 宝塔 → 站点 → SSL → Let's Encrypt 申请免费证书，勾选「强制 HTTPS」。
- 装完证书后，**把 5 个 location 段同步到 443 的 server 块里**（宝塔会自动生成 443 段，但不会帮你搬 location）。
- 支付宝的 `ALIPAY_NOTIFY_URL` 必须是 **公网可访问的 https 地址**，否则异步回调收不到，订单不会自动变已支付。改完 `.env` 要 `pm2 reload linguaflow-server --update-env`。

### 9. 之后每次更新

```bash
cd /www/wwwroot/linguaflow && bash scripts/deploy-baota.sh
```

脚本会依次做：拉代码 → 装依赖 → prisma generate → 构建 → PM2 reload → 健康检查。
（从 Windows 传上去的 `sh` 文件如果报 `\r: command not found`，先 `sed -i 's/\r$//' scripts/deploy-baota.sh`）

只改了前端的话，重新 build 后浏览器 **Ctrl+Shift+R 硬刷**即可，PM2 不用动。

---

## 四、排错清单

| 现象 | 原因 | 处理 |
|---|---|---|
| 站点 502 | 后端没起来 / 反代端口写错 | `pm2 list`、`pm2 logs linguaflow-server`、`ss -lntp \| grep 809` |
| `/api/xxx` 返回 404，nginx 日志有 `open() .../api/xxx failed` | nginx 把它当静态文件了，location 没配对 | 检查站点 conf 里有没有 `location /api/` |
| 接口 404 但路径看着没错 | `proxy_pass` 结尾带了斜杠，把 `/api` 前缀吃掉了 | 改成 `proxy_pass http://127.0.0.1:8090;`（**结尾无斜杠**） |
| AI 回复「一次性全部出现」，没有逐字效果 | nginx 缓冲了 SSE | 确认 `/api/` 段里有 `proxy_buffering off;` 和 `proxy_send_timeout 600s;` |
| 支付完成后前端没收到实时通知 | Socket.IO 没走通 | 确认配的是 `location /socket.io/`（**不是 `/ws`**）且带 `Upgrade` / `Connection "upgrade"` |
| WebSocket 频繁断连 | 长连接被 60s 默认超时掐断 | `/socket.io/` 段里 `proxy_read_timeout 3600s` |
| 管理端所有接口 401 | 前端 `VITE_API_BASE` 或 token 不对 | 确认构建时 `VITE_API_BASE=/api`；`VITE_SIGN_KEY` 与后端 `SIGN_KEY` 一致 |
| 创建订单 400 | 签名密钥不一致 | 同上，改完**必须重新 build 前端** |
| 启动报 `Query engine binary ... could not be found` | Prisma 引擎平台不匹配 | 在服务器上 `npm run prisma:generate` 后重启 |
| 上传大文件失败 | nginx 体积限制 | 站点里 `client_max_body_size 30m`；已配分片上传（单片 5MB） |
| 学习日报没发邮件 | SMTP 未配置或授权码错误 | 看 `pm2 logs linguaflow-server`，`MAIL_*` 三项都要填 |
| 改完 nginx 配置没反应 | `nginx -s reload` 在这台机器静默失效 | `kill -HUP $(cat /www/server/nginx/logs/nginx.pid)`，浏览器硬刷 |
| 页面白屏 | root 指错 / SPA 回退缺失 | root 必须是 `.../apps/web/dist`；确认 `try_files ... /index.html` |

---

## 五、上线后的验收清单

```bash
# 1. 两个后端进程在线
pm2 list

# 2. 健康检查
curl -s http://127.0.0.1:8090/api/health
curl -s http://127.0.0.1:8091/api/ai/health

# 3. 走域名验证（应返回 200）
curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/
curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/admin/login
curl -s https://your-domain.com/api/health

# 4. 登录 + 接口冒烟（在项目里跑，改一下 BASE 域名）
node scripts/smoke-test.mjs
node scripts/ai-smoke.mjs
```

浏览器手测四条链路：
1. 注册 / 登录 → 拿到 token
2. 课程列表 → 详情 → 下单 → 支付回调（Mock 模式可直接点）→ **WebSocket 弹出支付成功通知**
3. AI 对话 → 回复**逐字**出现（这一条就是在验证 SSE 没被 nginx 缓冲）
4. 管理端 `admin/admin123` 登录 → 看板数据非空

> 首次部署后**立刻改掉默认密码**（管理端 `admin`、演示用户 `demo`），`seed`/SQL 里的初始密码是公开的。
