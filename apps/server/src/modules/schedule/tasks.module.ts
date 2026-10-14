import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ReportController } from './report.controller';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { OrderModule } from '../order/order.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [AiModule, MailModule, OrderModule, GatewayModule],
  controllers: [ReportController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
