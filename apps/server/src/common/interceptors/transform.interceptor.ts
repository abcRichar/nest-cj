import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * 统一响应包装：{ code, message, data, timestamp }
 * SSE / 文件下载等已自行处理响应的接口通过 @NoWrap() 跳过。
 */
export const NO_WRAP = 'noWrap';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const handler = context.getHandler();
    const noWrap = Reflect.getMetadata(NO_WRAP, handler);
    const res = context.switchToHttp().getResponse();
    // 已标记跳过、或响应头已经是 SSE / 二进制流时，原样返回
    if (noWrap || res?.getHeader?.('x-no-wrap')) return next.handle();

    return next.handle().pipe(
      map((data) => {
        // 已经是标准结构就不再包一层
        if (data && typeof data === 'object' && 'code' in (data as object) && 'data' in (data as object)) {
          return data;
        }
        return { code: 0, message: 'success', data: data ?? null, timestamp: Date.now() };
      }),
    );
  }
}
