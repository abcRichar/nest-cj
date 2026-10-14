import { SetMetadata } from '@nestjs/common';

/** 标记接口无需登录 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
