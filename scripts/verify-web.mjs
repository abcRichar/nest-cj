/**
 * 前端页面验收：Chrome headless + CDP
 *   node scripts/verify-web.mjs
 *
 * 做三件事：
 *   1. 逐页截图（目检渲染）
 *   2. 抓 Runtime.exceptionThrown / console.error（Vue 页面常「看着正常其实已崩」）
 *   3. 用 Runtime.evaluate 断言 DOM 契约（有内容、非空态、无报错 toast）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ORIGIN = process.env.WEB_ORIGIN || 'http://127.0.0.1:5173';
const API = process.env.SMOKE_BASE || 'http://127.0.0.1:8080/api';
const PORT = 9333;
const OUT = path.resolve('.tmp/shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------- 极简 CDP 客户端 ------------------------- */
function makeCdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) {
      listeners.push(msg);
    }
  });
  return {
    send(method, params = {}) {
      const mid = ++id;
      return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
        setTimeout(() => {
          if (pending.has(mid)) {
            pending.delete(mid);
            reject(new Error(`CDP timeout: ${method}`));
          }
        }, 60_000);
      });
    },
    drain() {
      const out = listeners.splice(0, listeners.length);
      return out;
    },
  };
}

async function main() {
  const profile = path.join(os.tmpdir(), `elp-verify-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1440,1000',
    'about:blank',
  ]);
  chrome.stderr.on('data', () => {});

  // 等调试端口就绪
  let version = null;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      version = await r.json();
      break;
    } catch {
      await sleep(300);
    }
  }
  if (!version) throw new Error('Chrome 调试端口未就绪');
  console.log(`浏览器: ${version['Browser']}\n`);

  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
  ).json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const cdp = makeCdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  /* ---------- 取两个 token，供需要登录的页面注入 ---------- */
  const tokens = {};
  for (const [key, body] of [
    ['elp_token', { account: 'demo@linguaflow.com', password: '123456' }],
    ['elp_admin_token', { account: 'admin', password: 'admin123' }],
  ]) {
    const url = key === 'elp_token' ? `${API}/auth/login` : `${API}/admin/auth/login`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    tokens[key] = j?.data?.token ?? null;
  }
  console.log(`token: user=${tokens.elp_token ? 'OK' : 'MISS'} admin=${tokens.elp_admin_token ? 'OK' : 'MISS'}\n`);

  const results = [];

  async function visit(name, route, { withToken } = {}) {
    cdp.drain();
    // 先回同源，便于写 localStorage
    await cdp.send('Page.navigate', { url: `${ORIGIN}/login` }).catch(() => {});
    await sleep(700);
    if (withToken) {
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.setItem(${JSON.stringify(withToken[0])}, ${JSON.stringify(tokens[withToken[0]] ?? '')});
                     localStorage.setItem(${JSON.stringify(withToken[1])}, ${JSON.stringify(JSON.stringify({ id: 1, nickname: 'x' }))});`,
      });
    } else {
      await cdp.send('Runtime.evaluate', {
        expression: `localStorage.removeItem('elp_token'); localStorage.removeItem('elp_admin_token');`,
      });
    }

    await cdp.send('Page.navigate', { url: `${ORIGIN}${route}` }).catch(() => {});

    // 轮询等待渲染完成：dev server 首次访问要现场转译模块，固定 sleep 会误判空白页
    let info = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      const probe = await cdp
        .send('Runtime.evaluate', {
          expression: `JSON.stringify({
            url: location.pathname,
            title: document.title,
            bodyLen: document.body.innerText.length,
            text: document.body.innerText.replace(/\\s+/g,' ').slice(0, 220),
            elCount: document.querySelectorAll('*').length,
            errToast: Array.from(document.querySelectorAll('.el-message--error')).map(e=>e.innerText).join('|'),
            tables: document.querySelectorAll('.el-table').length,
            canvases: document.querySelectorAll('canvas').length
          })`,
          returnByValue: true,
        })
        .catch(() => null);
      const val = probe?.result?.value;
      if (val) {
        info = JSON.parse(val);
        if (info.bodyLen > 200) break; // 已渲染出实质内容
      }
    }
    if (!info) info = { url: route, bodyLen: 0, text: '', elCount: 0, tables: 0, canvases: 0 };
    await sleep(600);

    const msgs = cdp.drain();
    const errors = [];
    for (const m of msgs) {
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description ?? '').split('\n')[0]);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push('ERR: ' + (m.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push('LOG: ' + String(m.params.entry.text).slice(0, 200));
      }
    }

    const shot = path.join(OUT, `${name}.png`);
    const cap = await cdp.send('Page.captureScreenshot', { captureBeyondViewport: true });
    fs.writeFileSync(shot, Buffer.from(cap.data, 'base64'));

    const ok =
      (info.bodyLen > (withToken ? 120 : 30) || info.elCount > 60) &&
      errors.length === 0 &&
      !info.errToast;
    results.push({ name, route, ok, info, errors, shot });
    console.log(`${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name.padEnd(18)} ${route}`);
    console.log(`        路由落到 ${info.url} · 正文 ${info.bodyLen} 字 · DOM ${info.elCount} 节点 · canvas ${info.canvases} · table ${info.tables}`);
    console.log(`        正文: ${info.text.slice(0, 120)}`);
    if (info.errToast) console.log(`        \x1b[31m错误提示: ${info.errToast}\x1b[0m`);
    for (const e of errors.slice(0, 4)) console.log(`        \x1b[31m${e}\x1b[0m`);
    console.log('');
  }

  await visit('01-home', '/');
  await visit('02-courses', '/courses');
  await visit('03-login', '/login');
  await visit('04-register', '/register');
  await visit('05-words', '/words', { withToken: ['elp_token', 'elp_user'] });
  await visit('06-chat', '/chat', { withToken: ['elp_token', 'elp_user'] });
  await visit('07-my-orders', '/me/orders', { withToken: ['elp_token', 'elp_user'] });
  await visit('08-my-courses', '/me/courses', { withToken: ['elp_token', 'elp_user'] });
  await visit('09-admin-login', '/admin/login');
  await visit('10-admin-dashboard', '/admin/dashboard', { withToken: ['elp_admin_token', 'elp_admin_user'] });
  await visit('11-admin-users', '/admin/users', { withToken: ['elp_admin_token', 'elp_admin_user'] });
  await visit('12-admin-courses', '/admin/courses', { withToken: ['elp_admin_token', 'elp_admin_user'] });
  await visit('13-admin-orders', '/admin/orders', { withToken: ['elp_admin_token', 'elp_admin_user'] });
  await visit('14-admin-files', '/admin/files', { withToken: ['elp_admin_token', 'elp_admin_user'] });
  await visit('15-admin-reports', '/admin/reports', { withToken: ['elp_admin_token', 'elp_admin_user'] });

  /* ------------------------- 汇总 ------------------------- */
  const bad = results.filter((r) => !r.ok);
  console.log('================ 页面验收汇总 ================');
  console.log(`共 ${results.length} 页 · 通过 ${results.length - bad.length} · 失败 ${bad.length}`);
  for (const b of bad) {
    console.log(`\n[失败] ${b.name} ${b.route}`);
    console.log(`  路由: ${b.info.url} · 正文长度: ${b.info.bodyLen}`);
    console.log(`  正文: ${b.info.text}`);
    if (b.info.errToast) console.log(`  toast: ${b.info.errToast}`);
    for (const e of b.errors) console.log(`  ${e}`);
  }
  console.log(`\n截图目录: ${OUT}`);

  ws.close();
  chrome.kill();
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {}
  process.exit(bad.length ? 1 : 0);
}

main().catch((e) => {
  console.error('验收脚本异常:', e);
  process.exit(1);
});
