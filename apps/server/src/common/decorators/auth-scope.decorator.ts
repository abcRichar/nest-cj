import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'authScope';

/**
 * 限制 Token 作用域：
 *  - user  ：用户端签发的 token 才能访问
 *  - admin ：管理端签发的 token 才能访问
 * 避免用户端 token 直接打管理端接口。
 */
export const AuthScope = (scope: 'user' | 'admin') => SetMetadata(SCOPE_KEY, scope);
