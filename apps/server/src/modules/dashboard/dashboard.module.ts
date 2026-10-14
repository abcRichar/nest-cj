import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { UserModule } from '../user/user.module';
import { AiModule } from '../ai/ai.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [UserModule, AiModule, GatewayModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
