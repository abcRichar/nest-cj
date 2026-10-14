import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from '@elp/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPE_KEY } from '../decorators/auth-scope.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * 全局认证守卫：
 *  1. 解析 Bearer Token
 *  2. 校验签名与过期
 *  3. 校验 scope（用户端 / 管理端）
 *  4. 校验角色
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const raw: string | undefined =
      req.headers?.authorization ?? req.headers?.Authorization;

    if (!raw || !raw.startsWith('Bearer ')) {
      throw new UnauthorizedException('未登录或登录已过期');
    }
    const token = raw.slice(7).trim();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期');
    }

    // scope 校验
    const needScope = this.reflector.getAllAndOverride<'user' | 'admin'>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (needScope && payload.scope !== needScope) {
      throw new ForbiddenException('当前凭证无权访问该端接口');
    }

    // 角色校验
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(payload.role)) {
      throw new ForbiddenException('权限不足');
    }

    req.user = payload;
    return true;
  }
}
