import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { OrderService } from './order.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { OrderStatus, UserRole } from '@elp/shared';
import { OrderQueryDto } from './order.controller';

export class AdminOrderQueryDto extends OrderQueryDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() courseId?: number;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
}

@ApiTags('管理端-订单')
@Controller('admin/orders')
@AuthScope('admin')
@Roles(UserRole.ADMIN)
export class AdminOrderController {
  constructor(private readonly order: OrderService) {}

  @Get()
  @ApiOperation({ summary: '订单列表' })
  list(@Query() query: AdminOrderQueryDto) {
    return this.order.adminList(query as any);
  }

  @Get(':orderNo')
  @ApiOperation({ summary: '订单详情' })
  detail(@Param('orderNo') orderNo: string) {
    return this.order.detail(orderNo);
  }

  @Post(':orderNo/refund')
  @ApiOperation({ summary: '退款并回收课程权限' })
  refund(@Param('orderNo') orderNo: string) {
    return this.order.adminRefund(orderNo);
  }
}
