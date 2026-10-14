/**
 * PM2 进程配置：主业务服务 + 独立 AI 服务
 *
 * 用法（项目根目录）：
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * 两个关键点：
 *   1. cwd 必须是各自的 app 目录 —— NestJS 的 ConfigModule 读的是「当前工作目录」下的 .env，
 *      cwd 写错会导致配置全部走默认值（连不上数据库、AI 地址是 127.0.0.1:8090 之类的僵尸配置）。
 *   2. exec_mode 必须是 fork、instances 必须是 1 —— 主服务里有 @nestjs/schedule 定时任务，
 *      cluster 多实例会让「学习日报」「关闭超时订单」被执行多次。
 *
 * 端口不在这里写，统一放在各 app 的 .env（PORT），保持单一真相源。
 */
const path = require('node:path');

const root = path.resolve(__dirname, '..');

module.exports = {
  apps: [
    {
      name: 'linguaflow-server',
      cwd: path.join(root, 'apps/server'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(root, 'logs/server-out.log'),
      error_file: path.join(root, 'logs/server-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'linguaflow-ai',
      cwd: path.join(root, 'apps/ai-service'),
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '700M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(root, 'logs/ai-out.log'),
      error_file: path.join(root, 'logs/ai-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
