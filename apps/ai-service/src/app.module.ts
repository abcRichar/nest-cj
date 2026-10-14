import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { aiServiceConfig } from './config/configuration';
import { InternalTokenGuard } from './common/internal-token.guard';
import { LlmModule } from './modules/llm/llm.module';
import { CheckpointModule } from './modules/checkpoint/checkpoint.module';
import { AgentService } from './modules/agent/agent.service';
import { ChatStreamController } from './modules/chat/chat-stream.controller';
import { ReportController } from './modules/report/report.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [aiServiceConfig],
    }),
    LlmModule,
    CheckpointModule,
  ],
  controllers: [ChatStreamController, ReportController],
  providers: [
    AgentService,
    { provide: APP_GUARD, useClass: InternalTokenGuard },
  ],
})
export class AppModule {}
