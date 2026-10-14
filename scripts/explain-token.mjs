/**
 * 现场拆解项目里的三套凭证算法：
 *   1) JWT（登录令牌）      —— 用户端 / 管理端身份
 *   2) x-sign（接口签名）   —— 关键写接口防盗改
 *   3) x-internal-token     —— 主服务 -> AI 服务的内部调用
 *
 * 跑法：node scripts/explain-token.mjs
 */
import crypto from 'node:crypto';

const BASE = 'http://127.0.0.1:8080/api';
// 直接读 apps/server/.env 里配置的值
const JWT_SECRET = 'elp_super_secret_key_change_me_in_production';
const SIGN_KEY = 'elp_client_sign_key_dev';
const INTERNAL_TOKEN = 'elp_internal_token';

const line = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);
const b64url = (input) => Buffer.from(input).toString('base64url');
const fromB64url = (s) => Buffer.from(s, 'base64url').toString('utf8');

/* ==================================================================
 * 一、JWT
 * ================================================================== */
line('① JWT：登录令牌');

const loginRes = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ account: 'demo@linguaflow.com', password: '123456', loginType: 'email' }),
});
const loginJson = await loginRes.json();
const token = loginJson?.data?.token;
if (!token) {
  console.log('登录失败，原始返回：', JSON.stringify(loginJson).slice(0, 300));
  process.exit(1);
}
console.log('后端签发的 token：');
console.log('  ' + token);

const [hPart, pPart, sPart] = token.split('.');
console.log('\n--- 第 1 段：Header（Base64URL 解码）---');
console.log('  ' + fromB64url(hPart));
console.log('\n--- 第 2 段：Payload（Base64URL 解码）---');
const payload = JSON.parse(fromB64url(pPart));
console.log('  ' + JSON.stringify(payload, null, 2).replace(/\n/g, '\n  '));
console.log(`\n  iat(${payload.iat}) -> ${new Date(payload.iat * 1000).toLocaleString('zh-CN')}`);
console.log(`  exp(${payload.exp}) -> ${new Date(payload.exp * 1000).toLocaleString('zh-CN')}`);
console.log(`  有效期 = ${(payload.exp - payload.iat) / 86400} 天`);

console.log('\n--- 第 3 段：Signature ---');
console.log('  后端给出： ' + sPart);
const mySig = crypto
  .createHmac('sha256', JWT_SECRET)
  .update(`${hPart}.${pPart}`)
  .digest('base64url');
console.log('  我手工算： ' + mySig);
console.log('  两者一致： ' + (mySig === sPart ? '✅ 是' : '❌ 否'));

// 反向证明：拿手工签的 token 去调受保护接口
const forgedPayload = {
  ...payload,
  sub: 2,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const forgedToken =
  b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
  '.' +
  b64url(JSON.stringify(forgedPayload)) +
  '.' +
  crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(forgedPayload))}`)
    .digest('base64url');

const forgedInspect = await fetch(`${BASE}/user/profile`, {
  headers: { Authorization: `Bearer ${forgedToken}` },
});
const forgedBody = await forgedInspect.json();
console.log('\n  用手工拼的 token 调 /user/profile：');
console.log(`    HTTP ${forgedInspect.status} -> code=${forgedBody.code} ${forgedBody.message ?? ''}`);
console.log(`    ${forgedInspect.status === 200 ? '✅ 后端认可（说明签名算法就是纯 HMAC-SHA256）' : '❌ 后端拒绝'}`);

// 错误密钥对照
const wrongSig = crypto
  .createHmac('sha256', 'wrong_secret')
  .update(`${hPart}.${pPart}`)
  .digest('base64url');
const badRes = await fetch(`${BASE}/user/profile`, {
  headers: { Authorization: `Bearer ${hPart}.${pPart}.${wrongSig}` },
});
const badBody = await badRes.json().catch(() => ({}));
console.log('\n  换错误密钥签名的 token：');
console.log(`    HTTP ${badRes.status} -> ${badBody.message ?? ''}`);
console.log(`    ${badRes.status === 401 ? '✅ 被拒（密钥就是唯一凭据）' : '❌ 竟然通过了'}`);

/* ==================================================================
 * 二、x-sign 请求签名
 * ================================================================== */
line('② x-sign：关键写接口的请求签名');

const method = 'POST';
const path = '/api/orders';
const ts = Date.now();
const nonce = crypto.randomBytes(8).toString('hex');
const rawBody = JSON.stringify({ courseId: 1 });

const signRaw = `${method}\n${path}\n${ts}\n${nonce}\n${rawBody}`;
const sign = crypto.createHmac('sha256', SIGN_KEY).update(signRaw).digest('hex');

console.log('签名串（后端 SignGuard 里就是这么拼的）：');
console.log('  ' + JSON.stringify(signRaw).replace(/\\n/g, '\\n\n  '));
console.log('\n  = 逐行看：');
console.log('    METHOD    : ' + method);
console.log('    PATH      : ' + path);
console.log('    TIMESTAMP : ' + ts);
console.log('    NONCE     : ' + nonce);
console.log('    BODY      : ' + rawBody);
console.log('\n  HMAC-SHA256(签名串, SIGN_KEY) =');
console.log('    ' + sign);

const signedRes = await fetch(`${BASE}/orders`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-sign': sign,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
  },
  body: rawBody,
});
const signedBody = await signedRes.json();
console.log(`\n  带签名请求 -> HTTP ${signedRes.status} code=${signedBody.code} ${signedBody.message ?? ''}`);
console.log(`  ${signedRes.status < 400 ? '✅ 通过' : '❌ 失败'}`);

// 重放同一个 nonce
const replayRes = await fetch(`${BASE}/orders`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-sign': sign,
    'x-timestamp': String(ts),
    'x-nonce': nonce,
  },
  body: rawBody,
});
const replayBody = await replayRes.json().catch(() => ({}));
console.log(`\n  同 nonce 重放 -> HTTP ${replayRes.status} ${replayBody.message ?? ''}`);
console.log(`  ${replayRes.status >= 400 ? '✅ 被防重放拦截' : '❌ 竟然放行'}`);

// 篡改 body
const ts2 = Date.now();
const nonce2 = crypto.randomBytes(8).toString('hex');
const tamperRes = await fetch(`${BASE}/orders`, {
  method,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-sign': sign, // 旧签名
    'x-timestamp': String(ts2),
    'x-nonce': nonce2,
  },
  body: JSON.stringify({ courseId: 999 }), // 篡改后的 body
});
const tamperBody = await tamperRes.json().catch(() => ({}));
console.log(`\n  签名不变但 body 改成 courseId:999 -> HTTP ${tamperRes.status} ${tamperBody.message ?? ''}`);
console.log(`  ${tamperRes.status >= 400 ? '✅ 被拦（签名绑定了 body）' : '❌ 放行'}`);

/* ==================================================================
 * 三、x-internal-token
 * ================================================================== */
line('③ x-internal-token：主服务 → AI 服务的内部令牌');

console.log('这不是"算"出来的，是配置里约定的固定串（apps/server/.env + apps/ai-service/.env 各一份）：');
console.log('  AI_SERVICE_TOKEN = ' + INTERNAL_TOKEN);
console.log('  主服务发起调用时放进请求头：x-internal-token: ' + INTERNAL_TOKEN);

const noToken = await fetch('http://127.0.0.1:8090/api/ai/models').catch(() => null);
if (noToken) {
  const b = await noToken.json().catch(() => ({}));
  console.log(`\n  不带令牌调 AI 服务 /api/ai/models -> HTTP ${noToken.status} ${b.message ?? ''}`);
  console.log(`  ${noToken.status === 401 ? '✅ 被拒（AI 服务不对外）' : '⚠️ 未拦截'}`);
}
const withToken = await fetch('http://127.0.0.1:8090/api/ai/models', {
  headers: { 'x-internal-token': INTERNAL_TOKEN },
}).catch(() => null);
if (withToken) {
  const b = await withToken.json().catch(() => ({}));
  console.log(`  带令牌调同接口 -> HTTP ${withToken.status} code=${b.code ?? '-'} ${b.message ?? ''}`);
  console.log(`  ${withToken.status === 200 ? '✅ 通过' : '❌ 失败'}`);
}

console.log('\n完成。\n');
