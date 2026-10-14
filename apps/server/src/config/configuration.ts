import { registerAs } from '@nestjs/config';

const bool = (v: string | undefined, def = false) =>
  v === undefined ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  name: process.env.APP_NAME ?? 'elp-server',
  port: Number(process.env.PORT ?? 8080),
  apiPrefix: process.env.API_PREFIX ?? '/api',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** 接口签名密钥：需与前端 VITE_SIGN_KEY 一致 */
  signKey: process.env.SIGN_KEY ?? 'elp_client_sign_key_dev',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? 'elp_dev_secret',
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
}));

export const aiConfig = registerAs('ai', () => ({
  baseUrl: process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8090',
  token: process.env.AI_SERVICE_TOKEN ?? 'elp_internal_token',
  timeout: Number(process.env.AI_SERVICE_TIMEOUT ?? 120_000),
}));

export const alipayConfig = registerAs('alipay', () => ({
  appId: process.env.ALIPAY_APP_ID ?? '',
  privateKey: (process.env.ALIPAY_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  alipayPublicKey: (process.env.ALIPAY_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
  gateway: process.env.ALIPAY_GATEWAY ?? 'https://openapi.alipay.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
  returnUrl: process.env.ALIPAY_RETURN_URL ?? '',
  /** 未配置密钥时走 Mock 模式，方便本地跑通全流程 */
  get mock() {
    return !process.env.ALIPAY_APP_ID;
  },
}));

export const minioConfig = registerAs('minio', () => ({
  endPoint: process.env.MINIO_ENDPOINT ?? '127.0.0.1',
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: bool(process.env.MINIO_USE_SSL),
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  bucket: process.env.MINIO_BUCKET ?? 'english-platform',
  publicUrl: process.env.MINIO_PUBLIC_URL ?? 'http://127.0.0.1:9000',
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST ?? '',
  port: Number(process.env.MAIL_PORT ?? 465),
  secure: bool(process.env.MAIL_SECURE, true),
  user: process.env.MAIL_USER ?? '',
  pass: process.env.MAIL_PASS ?? '',
  from: process.env.MAIL_FROM ?? '',
  get enabled() {
    return Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
  },
}));

export const scheduleConfig = registerAs('schedule', () => ({
  enabled: bool(process.env.ENABLE_SCHEDULE, true),
  dailyReportCron: process.env.DAILY_REPORT_CRON ?? '0 0 21 * * *',
}));
