import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AdminUpdateUserDto, UserQueryDto } from './dto/user.dto';
import { UserStatus, normalizePage } from '@elp/shared';
import dayjs from 'dayjs';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /** 管理端：用户列表 */
  async list(query: UserQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { username: { contains: query.keyword } },
              { nickname: { contains: query.keyword } },
              { email: { contains: query.keyword } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          avatar: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { orders: true, courses: true, conversations: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: rows.map((u) => ({
        ...u,
        orderCount: u._count.orders,
        courseCount: u._count.courses,
        conversationCount: u._count.conversations,
        _count: undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const [orders, studyAgg, words, reports] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { id: 'desc' },
        take: 10,
        include: { course: { select: { title: true } } },
      }),
      this.prisma.studyRecord.aggregate({ where: { userId: id }, _sum: { duration: true } }),
      this.prisma.word.groupBy({ by: ['status'], where: { userId: id }, _count: { _all: true } }),
      this.prisma.dailyReport.count({ where: { userId: id } }),
    ]);

    return {
      ...user,
      totalDuration: studyAgg._sum.duration ?? 0,
      words: Object.fromEntries(words.map((w) => [w.status, w._count._all])),
      reportCount: reports,
      recentOrders: orders.map((o) => ({
        orderNo: o.orderNo,
        courseTitle: o.course?.title,
        amount: o.amount,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }

  async update(id: number, dto: AdminUpdateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('用户不存在');
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, username: true, nickname: true, email: true, role: true, status: true },
    });
  }

  async updateStatus(id: number, status: UserStatus) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('用户不存在');
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, username: true, status: true },
    });
  }

  async resetPassword(id: number, password: string) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('用户不存在');
    await this.prisma.user.update({
      where: { id },
      data: { password: await bcrypt.hash(password, 10) },
    });
    return { success: true };
  }

  async remove(id: number) {
    const exists = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!exists) throw new NotFoundException('用户不存在');
    if (exists.role === 'ADMIN') throw new NotFoundException('管理员账号不可删除');
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  /** 新增用户数趋势（看板用） */
  async registerTrend(days = 14) {
    const start = dayjs().subtract(days - 1, 'day').startOf('day').toDate();
    const rows = await this.prisma.user.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true },
    });
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) map.set(dayjs().subtract(i, 'day').format('MM-DD'), 0);
    for (const r of rows) {
      const k = dayjs(r.createdAt).format('MM-DD');
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }
}
