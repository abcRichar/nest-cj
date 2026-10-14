import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MysqlSaver } from './mysql-checkpointer';
import { parseMysqlUrl } from '../../config/configuration';

@Injectable()
export class CheckpointService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CheckpointService.name);
  private saver!: MysqlSaver;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('ai.databaseUrl')!;
    try {
      this.saver = new MysqlSaver(parseMysqlUrl(url));
      await this.saver.init();
    } catch (e) {
      this.logger.error(`Checkpoint 表初始化失败：${(e as Error).message}`);
      this.logger.error('请确认 DATABASE_URL 正确，且已导入 SQL（checkpoints 等三张表）');
    }
  }

  async onModuleDestroy() {
    await this.saver?.close();
  }

  get instance(): MysqlSaver | undefined {
    return this.saver;
  }

  /** 清空某会话的全部检查点（删除会话时调用） */
  async deleteThread(threadId: string) {
    await this.saver?.deleteThread(threadId);
  }
}
