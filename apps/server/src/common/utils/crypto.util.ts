import * as crypto from 'node:crypto';

/**
 * 接口安全工具：
 *  - AES-256-CBC 加解密（敏感字段，如手机号、身份证）
 *  - HMAC-SHA256 签名 / 验签（防篡改 + 防重放）
 *
 * 约定签名串：method + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + rawBody
 */

const ALGO = 'aes-256-cbc';

export function md5(input: crypto.BinaryLike): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

export function sha256(input: crypto.BinaryLike): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** HMAC-SHA256 签名 */
export function hmacSign(raw: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

/** 恒定时间比较，避免时序攻击 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest(); // 32 字节
}

/** AES-256-CBC 加密，返回 iv:cipher（均 hex） */
export function aesEncrypt(plain: string, secret: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

/** AES-256-CBC 解密 */
export function aesDecrypt(payload: string, secret: string): string {
  const [ivHex, dataHex] = payload.split(':');
  if (!ivHex || !dataHex) throw new Error('密文格式错误');
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(secret), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
