import { Module } from '@nestjs/common';
import { NoticeController } from './notice.controller';
import { AdminNoticeController } from './admin-notice.controller';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [NoticeController, AdminNoticeController],
})
export class NoticeModule {}
