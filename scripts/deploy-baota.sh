#!/usr/bin/env bash
# ============================================================
# LinguaFlow 宝塔服务器更新脚本（在服务器上执行）
#   bash scripts/deploy-baota.sh
#
# 首次部署也用它，之后每次改完代码 pull 下来再跑一遍即可。
# 如果是从 Windows 传上来的，先修正换行符：
#   sed -i 's/\r$//' scripts/deploy-baota.sh
# ============================================================
set -euo pipefail

ROOT="${ROOT:-/www/wwwroot/linguaflow}"
# vite 打包 + vue-tsc 比较吃内存，1.5G 内存的小机器不加这个参数会被 OOM Killer 杀掉
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

cd "$ROOT"
mkdir -p logs

echo "==> [1/6] 同步代码"
if [ -d .git ]; then
  git pull --ff-only || echo "    git pull 跳过（有本地改动）"
else
  echo "    非 git 目录，跳过"
fi

echo "==> [2/6] 安装依赖（Monorepo 根目录一次装齐）"
npm install --no-audit --no-fund

echo "==> [3/6] 生成 Prisma Client"
# ★ 必须在服务器上生成：query engine 二进制是分平台的，
#   在 Windows 上生成的引擎拿到 Linux 上跑会报
#   'Query engine binary for current platform "debian-openssl-3.0.x" could not be found'
npm run prisma:generate

echo "==> [4/6] 构建四个包（顺序：shared -> server -> ai -> web）"
npm run build

echo "==> [5/6] 重启后端进程"
if pm2 describe linguaflow-server >/dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.cjs --update-env
else
  pm2 start deploy/ecosystem.config.cjs
fi
pm2 save

echo "==> [6/6] 健康检查"
sleep 6
echo -n "    主业务服务 :8090  -> "
curl -s -m 10 http://127.0.0.1:8090/api/health || echo "失败，看 pm2 logs linguaflow-server"
echo
echo -n "    AI    服务 :8091  -> "
curl -s -m 10 http://127.0.0.1:8091/api/ai/health || echo "失败，看 pm2 logs linguaflow-ai"
echo
echo
echo "完成。前端静态产物在 apps/web/dist，nginx 的 root 指向它即可。"
echo "改了 nginx 配置记得：kill -HUP \$(cat /www/server/nginx/logs/nginx.pid)"
