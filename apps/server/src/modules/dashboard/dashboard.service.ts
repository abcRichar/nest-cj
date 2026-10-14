import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClientService } from '../ai/ai-client.service';
import { EventsGateway } from '../gateway/events.gateway';
import { UserService } from '../user/user.service';
import { OrderStatus } from '@elp/shared';
import dayjs from 'dayjs';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UserService,
    private readonly ai: AiClientService,
    private readonly gateway: EventsGateway,
  ) {}

  /** 数据看板 */
  async stat() {
    const todayStart = dayjs().startOf('day').toDate();
    const weekStart = dayjs().subtract(6, 'day').startOf('day').toDate();

    const [
      userTotal,
      userTodayNew,
      orderTotal,
      orderTodayCount,
      revenueAgg,
      revenueTodayAgg,
      courseTotal,
      activeUser7d,
      unreadReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.order.aggregate({
        where: { status: OrderStatus.PAID, paidAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      this.prisma.course.count(),
      this.prisma.studyRecord
        .findMany({
          where: { createdAt: { gte: weekStart } },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((r) => r.length),
      this.prisma.dailyReport.count({ where: { emailed: false } }),
    ]);

    // 近 14 天趋势
    const days = 14;
    const trendStart = dayjs().subtract(days - 1, 'day').startOf('day').toDate();
    const [paidOrders, newUsers] = await Promise.all([
      this.prisma.order.findMany({
        where: { status: OrderStatus.PAID, paidAt: { gte: trendStart } },
        select: { paidAt: true, amount: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
    ]);

    const trend: Array<{ date: string; revenue: number; orders: number; newUsers: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = dayjs().subtract(i, 'day').format('MM-DD');
      const dayOrders = paidOrders.filter((o) => dayjs(o.paidAt).format('MM-DD') === key);
      trend.push({
        date: key,
        revenue: dayOrders.reduce((s, o) => s + o.amount, 0),
        orders: dayOrders.length,
        newUsers: newUsers.filter((u) => dayjs(u.createdAt).format('MM-DD') === key).length,
      });
    }

    // 热销课程
    const hot = await this.prisma.order.groupBy({
      by: ['courseId'],
      where: { status: OrderStatus.PAID },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { courseId: 'desc' } },
      take: 5,
    });
    const hotCourses = await this.prisma.course.findMany({
      where: { id: { in: hot.map((h) => h.courseId) } },
      select: { id: true, title: true },
    });
    const titleMap = new Map(hotCourses.map((c) => [c.id, c.title]));

    return {
      userTotal,
      userTodayNew,
      orderTotal,
      orderTodayCount,
      revenueTotal: revenueAgg._sum.amount ?? 0,
      revenueToday: revenueTodayAgg._sum.amount ?? 0,
      courseTotal,
      activeUser7d,
      unreadReports,
      onlineCount: this.gateway.onlineCount(),
      trend,
      hotCourses: hot.map((h) => ({
        courseId: h.courseId,
        title: titleMap.get(h.courseId) ?? `课程#${h.courseId}`,
        sales: h._count._all,
        revenue: h._sum.amount ?? 0,
      })),
    };
  }

  /** 用户注册趋势 */
  registerTrend(days = 14) {
    return this.users.registerTrend(days);
  }

  /** 系统健康（含 AI 服务探活） */
  async health() {
    const [dbOk, aiHealth] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false),
      this.ai.health(),
    ]);
    return {
      server: 'UP',
      database: dbOk ? 'UP' : 'DOWN',
      aiService: aiHealth,
      socketOnline: this.gateway.onlineCount(),
      uptime: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      node: process.version,
    };
  }
}
