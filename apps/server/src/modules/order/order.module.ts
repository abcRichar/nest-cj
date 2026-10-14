import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { AlipayService } from './alipay.service';
import { OrderController, PaymentController } from './order.controller';
import { AdminOrderController } from './admin-order.controller';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [OrderController, PaymentController, AdminOrderController],
  providers: [OrderService, AlipayService],
  exports: [OrderService, AlipayService],
})
export class OrderModule {}
