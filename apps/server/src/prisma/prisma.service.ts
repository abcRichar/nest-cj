import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma 已连接数据库');
    } catch (e) {
      this.logger.error(`数据库连接失败：${(e as Error).message}`);
      throw e;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma 已断开数据库连接');
  }

  /** 便捷分页查询 */
  async paginate<T>(
    model: {
      findMany: (args: any) => Promise<T[]>;
      count: (args: any) => Promise<number>;
    },
    args: { where?: any; orderBy?: any; include?: any; select?: any } = {},
    page = 1,
    pageSize = 10,
  ): Promise<{ list: T[]; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      model.findMany({ ...args, skip, take: pageSize }),
      model.count({ where: args.where }),
    ]);
    return { list, total, page, pageSize };
  }
}
