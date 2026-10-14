import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OrderService } from './order.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SignedApi } from '../../common/decorators/signed-api.decorator';
import { NoWrap } from '../../common/decorators/no-wrap.decorator';
import { OrderStatus, PayType } from '@elp/shared';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @Type(() => Number) @IsInt() courseId!: number;
  @IsOptional() @IsEnum(PayType) payType?: PayType;
}

export class OrderQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
}

@ApiTags('订单')
@Controller('orders')
@AuthScope('user')
export class OrderController {
  constructor(private readonly order: OrderService) {}

  @SignedApi()
  @Post()
  @ApiOperation({ summary: '创建订单（需签名）' })
  create(@CurrentUser('sub') userId: number, @Body() dto: CreateOrderDto) {
    return this.order.create(userId, dto.courseId, dto.payType);
  }

  @Get()
  @ApiOperation({ summary: '我的订单' })
  list(@CurrentUser('sub') userId: number, @Query() query: OrderQueryDto) {
    return this.order.myOrders(userId, query);
  }

  @Get(':orderNo')
  @ApiOperation({ summary: '订单详情' })
  detail(@Param('orderNo') orderNo: string) {
    return this.order.detail(orderNo);
  }

  @Post(':orderNo/pay')
  @ApiOperation({ summary: '获取支付宝支付表单' })
  pay(@CurrentUser('sub') userId: number, @Param('orderNo') orderNo: string) {
    return this.order.getPayForm(userId, orderNo);
  }

  @Post(':orderNo/sync')
  @ApiOperation({ summary: '主动同步支付状态（轮询兜底）' })
  sync(@CurrentUser('sub') userId: number, @Param('orderNo') orderNo: string) {
    return this.order.syncFromAlipay(userId, orderNo);
  }

  @Post(':orderNo/cancel')
  @ApiOperation({ summary: '取消订单' })
  cancel(@CurrentUser('sub') userId: number, @Param('orderNo') orderNo: string) {
    return this.order.cancel(userId, orderNo);
  }
}

@ApiTags('支付')
@Controller('payment')
export class PaymentController {
  constructor(private readonly order: OrderService) {}

  /**
   * 支付宝异步通知（服务端 -> 服务端）
   * 必须返回纯文本 success，否则支付宝会持续重试
   */
  @Public()
  @NoWrap()
  @Post('alipay/notify')
  @ApiOperation({ summary: '支付宝异步回调' })
  async alipayNotify(@Body() body: Record<string, any>, @Res() res: Response) {
    const result = await this.order.handleAlipayNotify(body);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(result);
  }

  /** 支付宝同步跳转（用户浏览器） —— 直接重定向回前端结果页 */
  @Public()
  @Get('alipay/return')
  @ApiOperation({ summary: '支付宝同步跳转' })
  alipayReturn(@Query() query: Record<string, any>, @Res() res: Response) {
    const orderNo = query.out_trade_no ?? '';
    const target = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/payment/result?orderNo=${encodeURIComponent(orderNo)}`;
    res.redirect(target);
  }
}
