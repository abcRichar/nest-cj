import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { hmacSign, safeEqual } from '../utils/crypto.util';

export const SIGNED_KEY = 'signedApi';
/** 用 @SignedApi() 标记关键接口，走签名校验 */
export const SIGN_MAX_SKEW_MS = 5 * 60 * 1000; // 5 分钟防重放窗口

const usedNonces = new Map<string, number>();

@Injectable()
export class SignGuard implements CanActivate {
  private readonly logger = new Logger(SignGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const need = this.reflector.getAllAndOverride<boolean>(SIGNED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!need) return true;

    const req = context.switchToHttp().getRequest();
    const sign = req.headers['x-sign'] as string | undefined;
    const ts = Number(req.headers['x-timestamp']);
    const nonce = req.headers['x-nonce'] as string | undefined;

    if (!sign || !ts || !nonce) throw new ForbiddenException('缺少签名参数');

    if (Math.abs(Date.now() - ts) > SIGN_MAX_SKEW_MS) {
      throw new ForbiddenException('请求已过期，请重试');
    }
    if (usedNonces.has(nonce)) throw new ForbiddenException('重复请求（nonce 已使用）');

    const rawBody =
      typeof req.rawBody === 'string' && req.rawBody.length
        ? req.rawBody
        : JSON.stringify(req.body ?? {});

    const expected = hmacSign(
      `${req.method}\n${req.originalUrl ?? req.url}\n${ts}\n${nonce}\n${rawBody}`,
      this.config.get<string>('app.signKey') ?? 'elp_client_sign_key_dev',
    );

    if (!safeEqual(sign, expected)) {
      this.logger.warn(`签名校验失败 path=${req.url}`);
      throw new ForbiddenException('签名校验失败');
    }

    this.sweepNonces();
    usedNonces.set(nonce, Date.now());
    return true;
  }

  /** 清理过期 nonce，防止内存膨胀 */
  private sweepNonces() {
    const now = Date.now();
    for (const [k, t] of usedNonces) {
      if (now - t > SIGN_MAX_SKEW_MS) usedNonces.delete(k);
    }
  }
}
