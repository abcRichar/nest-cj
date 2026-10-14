import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@elp/shared';

/**
 * 从请求上下文取当前登录用户
 * @CurrentUser() user                  -> 整个 payload
 * @CurrentUser('sub') userId           -> 指定字段
 */
export const CurrentUser = createParamDecorator(
  (key: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user: JwtPayload = req.user;
    return key ? user?.[key] : user;
  },
);
