import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * AI 服务不对外暴露，只接受主业务服务携带内部令牌调用
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token =
      req.headers['x-internal-token'] ??
      (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');

    const expected = this.config.get<string>('ai.internalToken');
    if (!token || token !== expected) {
      throw new UnauthorizedException('AI 服务内部令牌校验失败');
    }
    return true;
  }
}
