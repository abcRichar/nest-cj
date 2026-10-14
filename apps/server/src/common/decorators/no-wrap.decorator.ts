import { SetMetadata } from '@nestjs/common';
import { NO_WRAP } from '../interceptors/transform.interceptor';

/**
 * 跳过全局响应包装。
 * 用于支付宝异步通知、SSE 等需要返回原始内容的接口。
 */
export const NoWrap = () => SetMetadata(NO_WRAP, true);
