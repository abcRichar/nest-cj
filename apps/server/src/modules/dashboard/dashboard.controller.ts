import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '@elp/shared';

@ApiTags('管理端-看板')
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin/dashboard')
  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '数据看板' })
  stat() {
    return this.dashboard.stat();
  }

  @Get('admin/health')
  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '系统健康检查' })
  health() {
    return this.dashboard.health();
  }

  @Get('admin/dashboard/register-trend')
  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '注册趋势' })
  registerTrend(@Query('days') days?: string) {
    return this.dashboard.registerTrend(days ? Number(days) : 14);
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: '对外健康检查' })
  publicHealth() {
    return { status: 'UP', service: 'elp-server', time: new Date().toISOString() };
  }
}
