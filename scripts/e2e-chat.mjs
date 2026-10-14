/**
 * 端到端 SSE 链路：前端(模拟) → 主业务服务 → AI 服务
 *   node scripts/e2e-chat.mjs
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8080/api';

async function main() {
  // 1) 登录
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'demo@linguaflow.com', password: '123456' }),
  });
  const token = (await lr.json())?.data?.token;
  console.log('登录:', token ? 'OK' : 'FAIL');

  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2) 建一个新会话（避免读到历史里 AI 服务离线时的旧消息）
  const roles = await (await fetch(`${BASE}/chat/roles`, { headers: H })).json();
  const roleId = (roles?.data?.[0] ?? {}).id;
  const cr = await fetch(`${BASE}/chat/conversations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ roleId, title: 'e2e 流式验证' }),
  });
  const conv = (await cr.json())?.data;
  console.log(`会话: id=${conv?.id} role=${roleId}`);

  // 3) 主服务 SSE 转发
  const res = await fetch(`${BASE}/chat/stream`, {
    method: 'POST',
    headers: { ...H, Accept: 'text/event-stream' },
    body: JSON.stringify({ conversationId: conv.id, content: '用一句话说说现在完成时的用法' }),
  }).catch((e) => {
    console.log('请求异常:', e.message);
    return null;
  });
  console.log(`SSE 状态: ${res?.status} 类型: ${res?.headers.get('content-type')?.split(';')[0]}`);

  let body = '';
  if (res?.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    const deadline = Date.now() + 40_000;
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

  const events = [...body.matchAll(/event:\s*([a-zA-Z_]+)/g)].map((m) => m[1]);
  const uniq = [...new Set(events)];
  const deltaCount = events.filter((e) => /delta|chunk|token|message/.test(e)).length;
  console.log(`事件类型: ${uniq.join(', ') || '(无)'}`);
  console.log(`增量事件数: ${deltaCount}`);
  console.log(`有终止事件: ${/event:\s*(done|end)/.test(body)}`);
  console.log(`是否报 AI 不可用: ${/不可用|unavailable|AI 服务暂/.test(body)}`);
  console.log('\n--- 片段 ---');
  console.log(body.slice(0, 700));
  console.log('--- 结束 ---');
}

main().catch((e) => console.error('异常:', e));
