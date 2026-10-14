import { SetMetadata } from '@nestjs/common';
import { SIGNED_KEY } from '../guards/sign.guard';

/** 关键接口（下单、支付、改密等）加签名校验 */
export const SignedApi = () => SetMetadata(SIGNED_KEY, true);
