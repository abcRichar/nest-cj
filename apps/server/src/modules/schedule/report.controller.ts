import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@elp/shared';

@ApiTags('学习日报')
@Controller()
export class ReportController {
  constructor(
    private readonly tasks: TasksService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('reports/mine')
  @AuthScope('user')
  @ApiOperation({ summary: '我的学习日报' })
  async mine(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    const list = await this.prisma.dailyReport.findMany({
      where: { userId },
      orderBy: { reportDate: 'desc' },
      take: limit ? Number(limit) : 10,
    });
    return list.map((r) => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null }));
  }

  @Post('admin/reports/trigger')
  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '手动触发全量学习日报生成' })
  trigger(@Body('date') date?: string) {
    return this.tasks.triggerForAll(date);
  }

  @Get('admin/reports')
  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '日报列表（管理端）' })
  async adminList(@Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    const p = Math.max(1, Number(page));
    const ps = Math.min(100, Math.max(1, Number(pageSize)));
    const [list, total] = await Promise.all([
      this.prisma.dailyReport.findMany({
        orderBy: { id: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: { user: { select: { id: true, username: true, email: true } } },
      }),
      this.prisma.dailyReport.count(),
    ]);
    return { list, total, page: p, pageSize: ps };
  }
}
