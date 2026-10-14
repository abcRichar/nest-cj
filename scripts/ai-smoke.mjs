/**
 * AI 服务冒烟测试
 *   node scripts/ai-smoke.mjs
 * 验证：健康检查、内部令牌鉴权、SSE 流式输出、主服务→AI 服务代理链路
 */
const AI_BASE = process.env.AI_BASE || 'http://127.0.0.1:8090/api/ai';
const TOKEN = process.env.AI_TOKEN || 'elp_internal_token';
const MAIN_BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8080/api';

let pass = 0;
let fail = 0;
const failures = [];
function log(ok, name, extra = '') {
  if (ok) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${extra ? '  ' + extra : ''}`);
  }
}

async function main() {
  console.log(`\nAI 服务: ${AI_BASE}\n`);

  {
    const r = await fetch(`${AI_BASE}/health`).catch(() => null);
    const j = await r?.json().catch(() => null);
    log(!!r && r.status === 200, '健康检查 /api/ai/health', JSON.stringify(j).slice(0, 160));
  }

  {
    // 内部令牌缺失 → 必须拒绝，避免 AI 服务裸奔
    const r = await fetch(`${AI_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadId: 'no-token', message: 'hi' }),
    }).catch(() => null);
    log(!!r && r.status === 401, '内部令牌守卫拒绝匿名调用', `status=${r?.status}`);
  }

  {
    const res = await fetch(`${AI_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': TOKEN },
      body: JSON.stringify({
        threadId: 'ai-smoke-thread-' + Date.now(),
        userId: 2,
        roleCode: 'tutor',
        systemPrompt: '你是一位耐心的英语口语教练。',
        message: '用一句话介绍英语学习方法',
        enableSearch: false,
      }),
    }).catch(() => null);

    const ct = res?.headers?.get('content-type') ?? '';
    log(
      !!res && res.status < 400 && ct.includes('text/event-stream'),
      'SSE 流式接口返回事件流',
      `status=${res?.status} type=${ct.split(';')[0]}`,
    );

    let body = '';
    if (res?.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        body += dec.decode(value, { stream: true });
        if (/event:\s*(done|end|error)/.test(body)) break;
      }
      try {
        await reader.cancel();
      } catch {}
    }
    const hasStart = /event:\s*(start|meta)/.test(body);
    const hasChunk = /event:\s*(chunk|delta|token|message|tool)/.test(body);
    const hasEnd = /event:\s*(done|end|error)/.test(body);
    log(body.length > 0, 'SSE 收到事件数据', `${body.length} 字节`);
    log(hasStart || hasChunk, 'SSE 事件结构（start / chunk）', `start=${hasStart} chunk=${hasChunk}`);
    log(hasEnd, 'SSE 有终止事件（done / error，不留悬挂连接）', `done=${hasEnd}`);
    console.log('\n--- SSE 原始片段（前 700 字符）---');
    console.log(body.slice(0, 700));
    console.log('--- 片段结束 ---\n');
  }

  {
    const res = await fetch(`${AI_BASE}/chat/stream-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': TOKEN },
      body: JSON.stringify({
        threadId: 'ai-smoke-sync-' + Date.now(),
        userId: 2,
        roleCode: 'tutor',
        systemPrompt: '你是一位耐心的英语口语教练。',
        message: '你好',
        enableSearch: false,
      }),
    }).catch(() => null);
    log(!!res && res.status < 400, '非流式降级接口 /api/ai/chat/stream-sync', `status=${res?.status}`);
  }

  {
    const r = await fetch(`${AI_BASE}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-token': TOKEN },
      body: JSON.stringify({
        userId: 2,
        nickname: '演示同学',
        date: new Date().toISOString().slice(0, 10),
        stats: { studyMinutes: 42, newWords: 18, reviewedWords: 30, courses: 2 },
      }),
    }).catch(() => null);
    const t = (await r?.text().catch(() => '')) ?? '';
    log(!!r && r.status < 400, '学习日报生成接口 /api/ai/report', `status=${r?.status} ${t.slice(0, 80)}`);
  }

  {
    // 主服务 → AI 服务的代理链路（管理端「立即生成日报」）
    const login = await fetch(`${MAIN_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'admin', password: 'admin123' }),
    }).catch(() => null);
    const lj = await login?.json().catch(() => null);
    const token = lj?.data?.token;
    const r = await fetch(`${MAIN_BASE}/admin/reports/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }).catch(() => null);
    const t = (await r?.text().catch(() => '')) ?? '';
    log(!!r && r.status < 400, '主服务代理调用 AI 生成日报 /admin/reports/trigger', `status=${r?.status} ${t.slice(0, 100)}`);
  }

  console.log(`\n================ AI 服务: ${pass} 通过 / ${fail} 失败 ================`);
  if (failures.length) console.log('失败项:\n  - ' + failures.join('\n  - '));
  console.log('');
}

main().catch((e) => {
  console.error('AI 冒烟异常:', e);
  process.exit(1);
});
