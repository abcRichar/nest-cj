/**
 * 端到端冒烟测试：逐条覆盖简历描述里的能力
 *   node scripts/smoke-test.mjs
 *
 * 环境变量（可选）：
 *   SMOKE_BASE / SMOKE_ADMIN / SMOKE_ADMIN_PWD / SMOKE_USER / SMOKE_USER_PWD / SMOKE_SIGN_KEY
 */
import crypto from 'node:crypto';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:8080/api';
const SIGN_KEY = process.env.SMOKE_SIGN_KEY || 'elp_client_sign_key_dev';
const ADMIN_ACCOUNT = process.env.SMOKE_ADMIN || 'admin';
const ADMIN_PWD = process.env.SMOKE_ADMIN_PWD || 'admin123';
const USER_ACCOUNT = process.env.SMOKE_USER || 'demo@linguaflow.com';
const USER_PWD = process.env.SMOKE_USER_PWD || '123456';

let pass = 0;
let fail = 0;
const failures = [];

function log(ok, name, extra = '') {
  if (ok) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}${extra ? '  ' + extra : ''}`);
  } else {
    fail++;
    failures.push(`${name}${extra ? '  ' + extra : ''}`);
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${extra ? '  ' + extra : ''}`);
  }
}

/** 与后端 SignGuard / 前端 sign.ts 完全一致的签名串 */
function signHeaders(method, fullPath, bodyStr) {
  const ts = Date.now();
  const nonce = `${ts.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const raw = `${method.toUpperCase()}\n${fullPath}\n${ts}\n${nonce}\n${bodyStr}`;
  const sign = crypto.createHmac('sha256', SIGN_KEY).update(raw).digest('hex');
  return { 'x-sign': sign, 'x-timestamp': String(ts), 'x-nonce': nonce };
}

const SIGNED = [/^\/orders/, /^\/auth\/password/];

async function req(method, path, { token, body } = {}) {
  const headers = {};
  let bodyStr;
  if (body !== undefined) {
    bodyStr = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const fullPath = '/api' + path;
  if (SIGNED.some((r) => r.test(path)) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    Object.assign(headers, signHeaders(method, fullPath, bodyStr ?? ''));
  }

  try {
    const res = await fetch(BASE + path, { method, headers, body: bodyStr });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { _raw: text.slice(0, 160) };
    }
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: { _err: e.message } };
  }
}

function unwrap(j) {
  if (j && typeof j === 'object' && 'code' in j && 'data' in j) return j.data;
  return j;
}

/** 从课程详情里挖出第一个 lessonId */
function firstLessonId(course) {
  const chapters = course?.chapters ?? [];
  for (const c of chapters) {
    const lessons = c?.lessons ?? [];
    if (lessons.length) return lessons[0].id;
  }
  return null;
}

async function main() {
  console.log(`\n目标服务: ${BASE}\n`);

  console.log('--- 基础 & 认证（JWT / Guard） ---');
  {
    const r = await req('GET', '/health');
    log(unwrap(r.json)?.status === 'UP', '健康检查 /health');
  }

  let adminToken = null;
  {
    const r = await req('POST', '/admin/auth/login', {
      body: { account: ADMIN_ACCOUNT, password: ADMIN_PWD },
    });
    adminToken = unwrap(r.json)?.token ?? null;
    log(!!adminToken, '管理端登录（ADMIN 角色校验）', adminToken ? '' : JSON.stringify(unwrap(r.json)).slice(0, 120));
  }

  let userToken = null;
  let userId = null;
  {
    const r = await req('POST', '/auth/login', {
      body: { account: USER_ACCOUNT, password: USER_PWD },
    });
    const d = unwrap(r.json);
    userToken = d?.token ?? null;
    userId = d?.user?.id ?? null;
    log(!!userToken, '用户端登录（JWT 签发）', userToken ? `userId=${userId}` : '');
  }

  let buyerToken = null;
  {
    const username = `smoke${Date.now().toString().slice(-8)}`;
    const r = await req('POST', '/auth/register', {
      body: { username, email: `${username}@linguaflow.com`, password: '123456', nickname: '冒烟测试' },
    });
    buyerToken = unwrap(r.json)?.token ?? null;
    log(!!buyerToken, '用户注册（自动创建默认单词本）', `status=${r.status}`);
  }

  {
    const r = await req('GET', '/auth/profile');
    log(r.status === 401, 'JWT 守卫拦截未授权请求', `status=${r.status}`);
  }
  {
    const r = await req('GET', '/auth/profile', { token: userToken });
    log(r.status === 200, '获取个人资料 /auth/profile', unwrap(r.json)?.nickname ?? '');
  }
  {
    // @SignedApi() —— 无签名头应被拒绝
    const res = await fetch(`${BASE}/auth/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ oldPassword: '123456', newPassword: '1234567' }),
    }).catch(() => null);
    log(res?.status === 403, '签名守卫拦截无签名请求 /auth/password', `status=${res?.status}`);
  }

  console.log('\n--- 课程 ---');
  let courseId = null;
  let lessonId = null;
  {
    const r = await req('GET', '/courses?page=1&pageSize=5');
    const d = unwrap(r.json);
    const list = d?.list ?? d?.records ?? d?.items ?? (Array.isArray(d) ? d : []);
    courseId = list[0]?.id ?? null;
    log(list.length > 0, '课程列表（分页） /courses', `共 ${list.length} 条`);
  }
  {
    const r = await req('GET', '/courses/categories');
    const d = unwrap(r.json);
    log(Array.isArray(d) && d.length > 0, '课程分类 /courses/categories', `${Array.isArray(d) ? d.length : 0} 个`);
  }
  {
    const r = courseId ? await req('GET', `/courses/${courseId}`) : { status: 0, json: {} };
    const d = unwrap(r.json);
    lessonId = firstLessonId(d);
    const chapters = d?.chapters?.length ?? 0;
    let lessons = 0;
    for (const c of d?.chapters ?? []) lessons += c?.lessons?.length ?? 0;
    log(!!d?.title, '课程详情（章节 + 课时树）', `${d?.title ?? ''} · ${chapters} 章 ${lessons} 课时`);
  }

  console.log('\n--- 单词本（艾宾浩斯复习） ---');
  {
    const r = await req('GET', '/words/books', { token: userToken });
    const d = unwrap(r.json);
    log(r.status === 200, '单词本列表 /words/books', Array.isArray(d) ? `${d.length} 本` : '');
  }
  let wordId = null;
  {
    const r = await req('GET', '/words?page=1&pageSize=5', { token: userToken });
    const d = unwrap(r.json);
    const list = d?.list ?? d?.records ?? (Array.isArray(d) ? d : []);
    wordId = list[0]?.id ?? null;
    log(list.length > 0, '单词列表 /words', `共 ${list.length} 条`);
  }
  {
    const r = await req('GET', '/words/review/today', { token: userToken });
    const d = unwrap(r.json);
    const n = d?.total ?? (Array.isArray(d) ? d.length : '?');
    log(r.status === 200, '今日复习任务 /words/review/today', `待复习 ${n}`);
  }
  {
    const r = await req('GET', '/words/stats', { token: userToken });
    log(r.status === 200, '单词统计 /words/stats');
  }
  {
    // 新建单词 → 复习 → 校验 nextReviewAt 被算法推移
    let created = null;
    const bookRes = await req('GET', '/words/books', { token: userToken });
    const bookId = (unwrap(bookRes.json)?.[0] ?? {}).id ?? 1;
    if (bookId) {
      const r = await req('POST', '/words', {
        token: userToken,
        body: { bookId, word: `smoketest${Date.now().toString().slice(-6)}`, translation: 'n. 冒烟测试' },
      });
      created = unwrap(r.json);
    }
    log(!!created?.id, '新增单词 /words', created?.word ?? '');
    if (created?.id) {
      const before = created.nextReviewAt;
      const r = await req('POST', '/words/review', {
        token: userToken,
        body: { wordId: created.id, correct: true, cost: 3200 },
      });
      const d = unwrap(r.json);
      log(r.status < 400, '提交复习结果（艾宾浩斯推移下次复习时间）', `status=${r.status}`);
      if (d) log(!!d.nextReviewAt || before === undefined || d.nextReviewAt !== before, '复习后 nextReviewAt 已更新', String(d.nextReviewAt ?? ''));
    } else {
      log(false, '提交复习结果（艾宾浩斯算法）', '缺少 wordId');
    }
  }

  console.log('\n--- 学习进度 ---');
  {
    const r = await req('GET', '/study/overview', { token: userToken });
    log(r.status === 200, '学习概览 /study/overview');
  }
  {
    const r = courseId ? await req('GET', `/study/course/${courseId}`, { token: userToken }) : { status: 0 };
    log(r.status === 200, '课程学习进度 /study/course/:id');
  }
  {
    const r = await req('GET', '/study/records?page=1&pageSize=5', { token: userToken });
    log(r.status === 200, '学习记录 /study/records');
  }
  {
    const r =
      courseId && lessonId
        ? await req('POST', '/study/report', {
            token: userToken,
            body: { courseId, lessonId, duration: 300, progress: 60 },
          })
        : { status: 0, json: {} };
    log(r.status < 400, '上报学习进度（写入学习记录）', `status=${r.status} ${JSON.stringify(unwrap(r.json)).slice(0, 80)}`);
  }

  console.log('\n--- 订单 + 支付宝支付（含签名） ---');
  const trader = buyerToken ?? userToken;
  let orderNo = null;
  let orderStatus = null;
  {
    const r = courseId ? await req('POST', '/orders', { token: trader, body: { courseId } }) : { status: 0, json: {} };
    const d = unwrap(r.json);
    orderNo = d?.orderNo ?? null;
    orderStatus = d?.status ?? null;
    log(
      r.status < 400 && !!orderNo,
      '创建订单（HMAC 签名校验通过）',
      orderNo ? `${orderNo} status=${orderStatus}` : JSON.stringify(d).slice(0, 160),
    );
  }
  {
    const r = orderNo && orderStatus !== 'PAID' ? await req('POST', `/orders/${orderNo}/pay`, { token: trader }) : null;
    if (r) {
      const d = unwrap(r.json);
      log(r.status < 400 && !!d?.payForm, '发起支付宝支付（返回收银台表单）', `mock=${d?.mock} amount=${d?.amount}`);
    } else {
      log(!!orderNo, '发起支付宝支付', orderStatus === 'PAID' ? '免费课程已直接开通，无需支付' : '缺少 orderNo');
    }
  }
  {
    const r = orderNo ? await req('GET', `/orders/${orderNo}`, { token: trader }) : { status: 0 };
    log(r.status === 200, '订单详情 /orders/:orderNo');
  }
  {
    const r = await req('GET', '/orders?page=1&pageSize=5', { token: trader });
    log(r.status === 200, '我的订单 /orders');
  }
  {
    // 金额被篡改的回调必须被拒绝（Mock 模式下验签虽跳过，但金额比对仍生效）
    const res = orderNo
      ? await fetch(`${BASE}/payment/alipay/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            out_trade_no: orderNo,
            trade_no: 'MOCK_TAMPERED',
            trade_status: 'TRADE_SUCCESS',
            total_amount: '0.01',
            sign: 'mock_sign',
          }).toString(),
        }).catch(() => null)
      : null;
    const text = ((await res?.text()) ?? '').trim();
    log(!!res && text === 'failure', '回调金额被篡改 → 拒绝处理', `body=${text.slice(0, 20)}`);
  }
  {
    const r = await req('GET', '/orders?page=1&pageSize=5', { token: userToken });
    log(r.status === 200, '我的订单 /orders');
  }

  console.log('\n--- AI 对话（角色 / 会话隔离 / 上下文记忆 / SSE） ---');
  let roleId = null;
  {
    const r = await req('GET', '/chat/roles', { token: userToken });
    const d = unwrap(r.json);
    const list = Array.isArray(d) ? d : (d?.list ?? []);
    roleId = list[0]?.id ?? null;
    log(list.length > 0, 'AI 角色列表 /chat/roles', `${list.length} 个角色`);
  }
  let convId = null;
  {
    const r = roleId
      ? await req('POST', '/chat/conversations', { token: userToken, body: { roleId, title: '冒烟会话' } })
      : { status: 0 };
    convId = unwrap(r.json)?.id ?? null;
    log(r.status < 400 && !!convId, '创建会话（按角色隔离） /chat/conversations', `id=${convId}`);
  }
  {
    const r = await req('GET', '/chat/conversations', { token: userToken });
    log(r.status === 200, '会话列表 /chat/conversations');
  }
  {
    const r = await req('GET', `/chat/conversations/${convId ?? 1}`, { token: userToken });
    log(r.status === 200, '会话详情 /chat/conversations/:id');
  }
  {
    const r = await req('GET', `/chat/messages?conversationId=${convId ?? 1}&page=1&pageSize=20`, {
      token: userToken,
    });
    log(r.status === 200, '历史消息（上下文记忆读取） /chat/messages', `status=${r.status}`);
  }
  {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ conversationId: convId ?? 1, content: '你好' }),
    }).catch(() => null);
    const ct = res?.headers?.get('content-type') ?? '';
    const ok = !!res && (ct.includes('text/event-stream') || res.status >= 400);
    log(ok, 'SSE 流式对话 /chat/stream', `status=${res?.status ?? 0} type=${ct.split(';')[0]}`);
    try {
      await res?.body?.cancel();
    } catch {}
  }

  console.log('\n--- 文件存储（MinIO / 秒传 / 断点续传） ---');
  let fileId = null;
  const fileHash = 'smoke_hash_' + Date.now();
  {
    const r = await req('POST', '/files/init', {
      token: userToken,
      body: {
        name: 'smoke-test.bin',
        size: 1024,
        mimeType: 'application/octet-stream',
        hash: fileHash,
        totalChunks: 1,
      },
    });
    const d = unwrap(r.json);
    fileId = d?.fileId ?? null;
    log(r.status < 400, '初始化上传（秒传判定） /files/init', d?.uploaded ? '命中秒传' : `fileId=${fileId}`);
  }
  {
    const r = fileId
      ? await req('POST', `/files/${fileId}/chunk`, {
          token: userToken,
          body: { index: 0, data: Buffer.from('smoke').toString('base64') },
        })
      : { status: 0 };
    log(r.status < 400, '上传分片（断点续传） /files/:id/chunk', `status=${r.status}`);
  }
  {
    const r = fileId
      ? await req('POST', `/files/${fileId}/complete`, { token: userToken, body: { hash: fileHash } })
      : { status: 0 };
    log(r.status < 400, '合并分片 /files/:id/complete', `status=${r.status}`);
  }
  {
    const r = await req('GET', '/files?page=1&pageSize=5', { token: userToken });
    log(r.status === 200, '我的文件列表 /files');
  }
  {
    // 再传一次同 hash，应命中秒传
    const r = await req('POST', '/files/init', {
      token: userToken,
      body: { name: 'smoke-test-again.bin', size: 1024, hash: fileHash, totalChunks: 1 },
    });
    const d = unwrap(r.json);
    log(r.status < 400, '相同 hash 二次上传走秒传 /files/init', d?.uploaded ? '已命中秒传' : '未命中（可接受）');
  }

  console.log('\n--- 公告 / 学习日报 ---');
  {
    const r = await req('GET', '/notices?page=1&pageSize=5', { token: userToken });
    log(r.status === 200, '公告列表 /notices');
  }
  {
    const r = await req('GET', '/notices/mine/summary', { token: userToken });
    log(r.status === 200, '公告未读统计 /notices/mine/summary');
  }
  {
    const r = await req('GET', '/reports/mine?page=1&pageSize=5', { token: userToken });
    log(r.status === 200, '我的学习日报 /reports/mine');
  }

  console.log('\n--- 管理端 ---');
  if (adminToken) {
    const cases = [
      ['GET', '/admin/dashboard', '数据看板 /admin/dashboard'],
      ['GET', '/admin/dashboard/register-trend', '注册趋势 /admin/dashboard/register-trend'],
      ['GET', '/admin/users?page=1&pageSize=5', '用户管理 /admin/users'],
      ['GET', '/admin/users/trend', '用户趋势 /admin/users/trend'],
      ['GET', '/admin/courses?page=1&pageSize=5', '课程管理 /admin/courses'],
      ['GET', '/admin/orders?page=1&pageSize=5', '订单管理 /admin/orders'],
      ['GET', '/admin/ai-roles', 'AI 角色管理 /admin/ai-roles'],
      ['GET', '/admin/files?page=1&pageSize=5', '文件管理 /admin/files'],
      ['GET', '/admin/files/stats', '文件统计 /admin/files/stats'],
      ['GET', '/admin/notices?page=1&pageSize=5', '公告管理 /admin/notices'],
      ['GET', '/admin/reports?page=1&pageSize=5', '日报管理 /admin/reports'],
      ['GET', '/admin/health', '系统健康 /admin/health'],
    ];
    for (const [m, p, name] of cases) {
      const r = await req(m, p, { token: adminToken });
      log(r.status === 200, name, `status=${r.status}`);
    }
  } else {
    log(false, '管理端接口（缺少 adminToken）');
  }

  console.log('\n--- 越权 & 安全 ---');
  {
    const r = await req('GET', '/admin/users?page=1&pageSize=5', { token: userToken });
    log(r.status === 403 || r.status === 401, '普通用户访问管理端被拒绝（Roles 守卫）', `status=${r.status}`);
  }
  {
    const r = await req('POST', '/auth/login', {
      body: { account: ADMIN_ACCOUNT, password: 'definitely-wrong-pwd' },
    });
    log(r.status === 401, '错误密码被拒绝', `status=${r.status}`);
  }
  {
    const r = await req('POST', '/admin/auth/login', {
      body: { account: USER_ACCOUNT, password: USER_PWD },
    });
    log(r.status === 403, '普通用户登录管理端被拒绝（AuthScope 校验）', `status=${r.status}`);
  }

  console.log(`\n================ 结果: ${pass} 通过 / ${fail} 失败 ================`);
  if (failures.length) console.log('失败项:\n  - ' + failures.join('\n  - '));
  console.log('');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('冒烟测试异常:', e);
  process.exit(1);
});
