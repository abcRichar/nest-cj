import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * 全局异常过滤器：把各类异常归一成 { code, message, data }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse() as any;
      message =
        typeof r === 'string'
          ? r
          : Array.isArray(r?.message)
            ? r.message[0]
            : (r?.message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = `数据已存在：${(exception.meta?.target as string[])?.join(', ') ?? '唯一字段冲突'}`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = '记录不存在';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `数据库操作失败(${exception.code})`;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    if (status >= 500) this.logger.error(`[${status}] ${message}`);

    res.status(status).json({
      code: status,
      message,
      data: null,
      timestamp: Date.now(),
    });
  }
}
