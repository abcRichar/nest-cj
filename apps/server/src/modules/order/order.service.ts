import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AlipayService } from './alipay.service';
import { EventsGateway } from '../gateway/events.gateway';
import { Prisma } from '@prisma/client';
import {
  OrderStatus,
  PayType,
  PublishStatus,
  fen2yuan,
  genOrderNo,
  normalizePage,
} from '@elp/shared';
import dayjs from 'dayjs';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alipay: AlipayService,
    private readonly gateway: EventsGateway,
  ) {}

  /* ============================ 下单 ============================ */

  async create(userId: number, courseId: number, payType: PayType = PayType.ALIPAY) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: PublishStatus.PUBLISHED },
    });
    if (!course) throw new NotFoundException('课程不存在或已下架');

    const owned = await this.prisma.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (owned) throw new BadRequestException('你已拥有该课程，无需重复购买');

    const pending = await this.prisma.order.findFirst({
      where: { userId, courseId, status: OrderStatus.PENDING },
    });
    if (pending) {
      // 已有未支付订单，直接复用，避免脏数据
      return this.orderVo(pending, course.title);
    }

    const order = await this.prisma.order.create({
      data: {
        orderNo: genOrderNo(),
        userId,
        courseId,
        amount: course.price,
        status: OrderStatus.PENDING,
        payType: course.price === 0 ? PayType.FREE : payType,
      },
    });

    // 免费课程：下单即发放
    if (course.price === 0) {
      await this.markPaid(order.orderNo, { tradeNo: `FREE_${order.orderNo}` });
      return this.detail(order.orderNo);
    }

    this.logger.log(`创建订单 ${order.orderNo} 用户=${userId} 课程=${courseId} 金额=${course.price}分`);
    return this.orderVo(order, course.title);
  }

  /* ============================ 支付 ============================ */

  /** 获取支付宝支付表单 */
  async getPayForm(userId: number, orderNo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNo, userId },
      include: { course: { select: { title: true } } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === OrderStatus.PAID) throw new BadRequestException('订单已支付');
    if (order.status !== OrderStatus.PENDING) throw new BadRequestException('订单状态异常，无法支付');

    const { payForm, mock } = await this.alipay.createPagePay({
      orderNo: order.orderNo,
      amount: fen2yuan(order.amount),
      subject: order.course.title,
      body: `英语学习平台课程购买`,
    });

    return { orderNo: order.orderNo, payForm, amount: order.amount, mock };
  }

  /**
   * 支付宝异步回调处理（幂等）
   * 返回 'success' / 'failure' 字符串，支付宝据此决定是否重试通知
   */
  async handleAlipayNotify(params: Record<string, any>): Promise<'success' | 'failure'> {
    this.logger.log(`收到支付宝异步通知 out_trade_no=${params.out_trade_no}`);

    if (!this.alipay.checkNotifySign(params)) {
      this.logger.warn('支付宝通知验签失败');
      return 'failure';
    }
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status)) {
      this.logger.warn(`忽略非成功交易状态：${params.trade_status}`);
      return 'success';
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNo: params.out_trade_no },
    });
    if (!order) {
      this.logger.warn(`通知对应的订单不存在：${params.out_trade_no}`);
      return 'success';
    }

    // 校验金额，防止篡改
    const notifyAmount = Math.round(Number(params.total_amount) * 100);
    if (notifyAmount !== order.amount) {
      this.logger.error(`订单金额不匹配 order=${order.orderNo} 本地=${order.amount} 通知=${notifyAmount}`);
      return 'failure';
    }

    if (order.status === OrderStatus.PAID) {
      this.logger.log(`订单 ${order.orderNo} 已处理过，跳过（幂等）`);
      return 'success';
    }

    await this.markPaid(order.orderNo, {
      tradeNo: params.trade_no,
      notifyRaw: JSON.stringify(params),
    });
    return 'success';
  }

  /** 主动查询并同步订单状态（前端轮询兜底） */
  async syncFromAlipay(userId: number, orderNo: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNo, userId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === OrderStatus.PAID) return this.detail(orderNo);

    const res = await this.alipay.queryTrade(orderNo);
    if (res.tradeStatus === 'TRADE_SUCCESS') {
      await this.markPaid(orderNo, { tradeNo: res.tradeNo });
    }
    return this.detail(orderNo);
  }

  /* ============================ 查询 ============================ */

  async myOrders(userId: number, query: { page?: number; pageSize?: number; status?: OrderStatus }) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: { course: { select: { title: true, cover: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      list: rows.map((o) => this.orderVo(o, o.course?.title, o.course?.cover)),
      total,
      page,
      pageSize,
    };
  }

  async detail(orderNo: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNo },
      include: { course: { select: { title: true, cover: true } } },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return this.orderVo(order, order.course?.title, order.course?.cover);
  }

  async cancel(userId: number, orderNo: string) {
    const order = await this.prisma.order.findFirst({ where: { orderNo, userId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status === OrderStatus.PAID) throw new BadRequestException('已支付订单不可取消');
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
    return { success: true };
  }

  /* ============================ 管理端 ============================ */

  async adminList(query: {
    page?: number;
    pageSize?: number;
    status?: OrderStatus;
    keyword?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? {
            OR: [
              { orderNo: { contains: query.keyword } },
              { user: { username: { contains: query.keyword } } },
              { course: { title: { contains: query.keyword } } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: dayjs(query.startDate).startOf('day').toDate() } : {}),
              ...(query.endDate ? { lte: dayjs(query.endDate).endOf('day').toDate() } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: {
          course: { select: { title: true, cover: true } },
          user: { select: { id: true, username: true, nickname: true, email: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: rows.map((o) => ({
        ...this.orderVo(o, o.course?.title, o.course?.cover),
        user: o.user,
      })),
      total,
      page,
      pageSize,
    };
  }

  async adminRefund(orderNo: string) {
    const order = await this.prisma.order.findUnique({ where: { orderNo } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.PAID) throw new BadRequestException('仅已支付订单可退款');

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.REFUNDED },
      }),
      // 回收课程权限
      this.prisma.userCourse.deleteMany({
        where: { userId: order.userId, courseId: order.courseId },
      }),
      this.prisma.course.update({
        where: { id: order.courseId },
        data: { studentCount: { decrement: 1 } },
      }),
    ]);

    this.gateway.pushOrderStatus(order.userId, {
      orderNo,
      status: OrderStatus.REFUNDED,
      message: '订单已退款，课程权限已回收',
    });
    return { success: true };
  }

  /** 超时未支付订单自动关闭（定时任务调用） */
  async closeExpiredOrders(minutes = 30) {
    const deadline = dayjs().subtract(minutes, 'minute').toDate();
    const res = await this.prisma.order.updateMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: deadline } },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
    if (res.count) this.logger.log(`自动关闭超时未支付订单 ${res.count} 笔`);
    return res.count;
  }

  /* ============================ 内部 ============================ */

  /**
   * 标记订单已支付 —— 整个支付闭环的收口动作（幂等）
   * 1. 订单置为 PAID
   * 2. 发放课程权限（user_course）
   * 3. 课程销量 +1
   * 4. 通过 Socket.IO 实时推送前端
   */
  private async markPaid(
    orderNo: string,
    extra: { tradeNo?: string; notifyRaw?: string } = {},
  ) {
    const order = await this.prisma.order.findUnique({ where: { orderNo } });
    if (!order || order.status === OrderStatus.PAID) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          alipayTradeNo: extra.tradeNo ?? null,
          ...(extra.notifyRaw ? { notifyRaw: extra.notifyRaw } : {}),
        },
      });

      await tx.userCourse.upsert({
        where: { userId_courseId: { userId: order.userId, courseId: order.courseId } },
        create: {
          userId: order.userId,
          courseId: order.courseId,
          orderId: order.id,
          progress: 0,
        },
        update: { orderId: order.id },
      });

      await tx.course.update({
        where: { id: order.courseId },
        data: { studentCount: { increment: 1 } },
      });
    });

    // 支付结果实时同步至前端（可能是落在收银台页面，也可能是已回到站内）
    this.gateway.pushPaymentResult(order.userId, {
      orderNo: order.orderNo,
      courseId: order.courseId,
      amount: order.amount,
      status: OrderStatus.PAID,
      paidAt: new Date().toISOString(),
      message: '支付成功，课程已开通',
    });

    this.logger.log(`订单 ${orderNo} 支付完成，已发放课程权限 userId=${order.userId}`);
  }

  private orderVo(o: any, courseTitle?: string, courseCover?: string | null) {
    return {
      id: o.id,
      orderNo: o.orderNo,
      userId: o.userId,
      courseId: o.courseId,
      courseTitle: courseTitle ?? null,
      courseCover: courseCover ?? null,
      amount: o.amount,
      status: o.status,
      payType: o.payType,
      alipayTradeNo: o.alipayTradeNo,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
    };
  }
}
