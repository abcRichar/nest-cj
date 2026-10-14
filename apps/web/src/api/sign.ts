/**
 * 前端接口签名（HMAC-SHA256）
 * 与后端 SignGuard 使用同一套拼接规则：
 *   METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY
 */
export async function hmacSignHex(raw: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(raw));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 非安全上下文（http 且非 localhost）下 crypto.subtle 不可用时的降级实现 */
export function hmacSignFallback(raw: string, secret: string): string {
  // 简易 FNV-1a 变体，仅用于开发环境联调；生产请使用 https
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = `${secret}|${raw}`;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 ^ (h1 >>> 7)) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
}

export async function safeHmac(raw: string, secret: string): Promise<string> {
  try {
    if (crypto?.subtle) return await hmacSignHex(raw, secret);
  } catch {
    /* fallthrough */
  }
  return hmacSignFallback(raw, secret);
}
