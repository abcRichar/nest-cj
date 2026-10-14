/**
 * WebSocket 链路冒烟测试
 *
 * 验证三件事：
 *   1. 前端的相对路径 io('/ws') 实际握手走的是 /socket.io/（engine.io 默认路径）
 *   2. 该路径能被 vite preview 的代理正确转发到主服务（线上对应 nginx 的 location /socket.io/）
 *   3. 带 JWT 时能通过网关鉴权并收到 connected 事件（namespace = /ws）
 *
 * 用法：
 *   node scripts/ws-smoke.mjs                       # 经 preview 4173（验证代理）
 *   WS_BASE=http://127.0.0.1:8080 node scripts/ws-smoke.mjs   # 直连后端
 */
import { io } from 'socket.io-client';

const BASE = process.env.WS_BASE || 'http://127.0.0.1:4173';
const ACCOUNT = process.env.WS_ACCOUNT || 'demo@linguaflow.com';
const PASSWORD = process.env.WS_PASSWORD || '123456';

const results = [];
const log = (ok, name, extra = '') => {
  results.push({ ok, name });
  console.log(`${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${extra ? '  ' + extra : ''}`);
};

/** 1) 握手探测：确认 /socket.io/ 被代理（返回 engine.io 握手包而不是 index.html） */
async function probeHandshake() {
  const url = `${BASE}/socket.io/?EIO=4&transport=polling`;
  const res = await fetch(url).catch(() => null);
  const text = (await res?.text().catch(() => '')) ?? '';
  const isHandshake = text.startsWith('0{"sid"');
  log(isHandshake, `engine.io 握手 /socket.io/ 代理生效`, `status=${res?.status} body=${text.slice(0, 48).replace(/\n/g, '')}`);
  return isHandshake;
}

/** 2) 取一个真实用户 token（同时验证 /api 代理） */
async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: ACCOUNT, password: PASSWORD, loginType: 'email' }),
  }).catch(() => null);
  const json = await res?.json().catch(() => null);
  const token = json?.data?.token ?? null;
  log(!!token, '用户登录（经 /api 代理）', token ? `token=${String(token).slice(0, 18)}…` : `status=${res?.status}`);
  return token;
}

/** 3) 建立 Socket.IO 连接并等 connected 事件 */
function connectSocket(token, { transports } = {}) {
  return new Promise((resolve) => {
    const socket = io(`${BASE}/ws`, {
      transports: transports ?? ['polling', 'websocket'],
      auth: { token },
      reconnection: false,
      timeout: 8000,
    });

    const done = (ok, label, extra = '') => {
      log(ok, label, extra);
      socket.close();
      resolve(ok);
    };

    const timer = setTimeout(() => done(false, 'Socket.IO 连接超时'), 10_000);

    socket.on('connect', () => {
      console.log(`      socket.id=${socket.id} transport=${socket.io.engine.transport.name}`);
    });
    socket.on('connected', (payload) => {
      clearTimeout(timer);
      done(true, '网关鉴权通过并收到 connected 事件', `userId=${payload?.userId}`);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      done(false, 'Socket.IO 连接失败', err.message);
    });
    socket.on('error', (err) => {
      console.warn('      gateway error:', err?.message ?? err);
    });
  });
}

/** 4) 纯 websocket 传输：验证 Upgrade 升级能过代理（nginx 的 Upgrade 头就对应这一步） */
function connectWebsocketOnly(token) {
  return new Promise((resolve) => {
    const socket = io(`${BASE}/ws`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      timeout: 8000,
    });
    const timer = setTimeout(() => {
      log(false, 'WebSocket 直连升级超时');
      socket.close();
      resolve(false);
    }, 10_000);
    socket.on('connected', (payload) => {
      clearTimeout(timer);
      const ok = socket.io.engine.transport.name === 'websocket';
      log(ok, 'WebSocket 直连升级成功（Upgrade 头生效）', `transport=${socket.io.engine.transport.name}`);
      socket.close();
      resolve(ok);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      log(false, 'WebSocket 直连升级失败', err.message);
      socket.close();
      resolve(false);
    });
  });
}

(async () => {
  console.log(`目标：${BASE}\n--- WebSocket 链路 ---`);

  const handshakeOk = await probeHandshake();
  const token = await login();
  if (token) {
    await connectSocket(token);
    if (handshakeOk) await connectWebsocketOnly(token);
  } else {
    log(false, '跳过连接测试（未取到 token）');
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n共 ${results.length} 项，通过 ${results.length - failed} 项${failed ? `，失败 ${failed} 项` : '，全部通过'}`);
  process.exit(failed ? 1 : 0);
})();
