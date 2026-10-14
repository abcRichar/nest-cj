import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OrderStatus } from '@elp/shared';
import dayjs from 'dayjs';

@ApiTags('通知公告')
@Controller('notices')
export class NoticeController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '公告列表' })
  async list(@Query('limit') limit = '5') {
    return this.prisma.notice.findMany({
      where: { published: true },
      orderBy: { id: 'desc' },
      take: Math.min(50, Number(limit) || 5),
    });
  }

  @AuthScope('user')
  @Get('mine/summary')
  @ApiOperation({ summary: '个人中心摘要（未读提醒 / 待办）' })
  async summary(@CurrentUser('sub') userId: number) {
    const now = new Date();
    const [dueWords, pendingOrders, unreadNotices, latestReport] = await Promise.all([
      this.prisma.word.count({
        where: {
          userId,
          status: { not: 'MASTERED' },
          OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
        },
      }),
      this.prisma.order.count({ where: { userId, status: OrderStatus.PENDING } }),
      this.prisma.notice.count({
        where: { published: true, createdAt: { gte: dayjs().subtract(7, 'day').toDate() } },
      }),
      this.prisma.dailyReport.findFirst({ where: { userId }, orderBy: { reportDate: 'desc' } }),
    ]);
    return { dueWords, pendingOrders, unreadNotices, latestReport };
  }
}
