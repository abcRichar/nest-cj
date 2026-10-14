import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClientService } from '../ai/ai-client.service';
import { MailService } from '../mail/mail.service';
import { OrderService } from '../order/order.service';
import { EventsGateway } from '../gateway/events.gateway';
import { SOCKET_EVENTS, type DailyReport } from '@elp/shared';
import dayjs from 'dayjs';

/**
 * 学习数据自动化处理：
 *   数据分析 -> AI 生成日报 -> 邮件推送，形成闭环
 *
 * 定时器采用 SchedulerRegistry 动态注册，
 * 这样 cron 表达式可以真正从 .env 读取（@Cron 装饰器在类定义期求值，读不到 ConfigModule 加载的变量）。
 */
@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly mail: MailService,
    private readonly order: OrderService,
    private readonly gateway: EventsGateway,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  private get enabled() {
    return this.config.get<boolean>('schedule.enabled') !== false;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('定时任务已关闭（ENABLE_SCHEDULE=false）');
      return;
    }

    const dailyReportCron =
      this.config.get<string>('schedule.dailyReportCron') || CronExpression.EVERY_DAY_AT_9PM;

    this.register('daily-report', dailyReportCron, () => this.handleDailyReport());
    this.register('close-expired-orders', CronExpression.EVERY_10_MINUTES, () =>
      this.handleCloseExpiredOrders(),
    );
    this.register('word-review-reminder', CronExpression.EVERY_HOUR, () => this.handleWordReminder());
  }

  private register(name: string, cronTime: string, task: () => Promise<void>) {
    try {
      const job = CronJob.from({
        cronTime,
        onTick: () => {
          task().catch((e) => this.logger.error(`任务 ${name} 执行异常：${(e as Error).message}`));
        },
        start: true,
      });
      this.scheduler.addCronJob(name, job);
      this.logger.log(`定时任务已注册：${name} (${cronTime})`);
    } catch (e) {
      this.logger.error(`定时任务 ${name} 注册失败：${(e as Error).message}`);
    }
  }

  /** 每晚生成并推送学习日报 */
  async handleDailyReport() {
    if (!this.enabled || this.running) return;
    this.running = true;
    const today = dayjs().format('YYYY-MM-DD');
    this.logger.log(`开始生成 ${today} 学习日报…`);

    try {
      const users = await this.collectActiveUsers(today);
      this.logger.log(`今日有学习行为的用户：${users.length} 人`);

      for (const u of users) {
        try {
          await this.generateForUser(u.id, today);
        } catch (e) {
          this.logger.error(`用户 ${u.id} 日报生成失败：${(e as Error).message}`);
        }
      }
    } finally {
      this.running = false;
      this.logger.log('学习日报任务结束');
    }
  }

  /** 单个用户：聚合 -> AI -> 落库 -> 邮件 -> 实时提醒 */
  async generateForUser(userId: number, date = dayjs().format('YYYY-MM-DD')): Promise<DailyReport | null> {
    const start = dayjs(date).startOf('day').toDate();
    const end = dayjs(date).endOf('day').toDate();

    const [user, studyAgg, wordsReviewed, courseCount, masteredWords, trendRows] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.studyRecord.aggregate({
        where: { userId, createdAt: { gte: start, lte: end } },
        _sum: { duration: true },
        _count: { _all: true },
      }),
      this.prisma.wordReviewLog.count({ where: { userId, createdAt: { gte: start, lte: end } } }),
      this.prisma.userCourse.count({ where: { userId } }),
      this.prisma.word.count({ where: { userId, status: 'MASTERED' } }),
      this.prisma.studyRecord.findMany({
        where: { userId, createdAt: { gte: dayjs(date).subtract(6, 'day').startOf('day').toDate() } },
        select: { createdAt: true, duration: true },
      }),
    ]);
    if (!user) return null;

    const trend: Array<{ date: string; duration: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayjs(date).subtract(i, 'day').format('YYYY-MM-DD');
      const duration = trendRows
        .filter((r) => dayjs(r.createdAt).format('YYYY-MM-DD') === d)
        .reduce((s, r) => s + r.duration, 0);
      trend.push({ date: d, duration });
    }

    const stats = {
      date,
      duration: studyAgg._sum.duration ?? 0,
      studyCount: studyAgg._count._all,
      wordsReviewed,
      courseCount,
      masteredWords,
      trend,
    };

    // 调 AI 生成日报正文（失败则降级为规则模板，不影响闭环）
    let content: string;
    try {
      content = await this.ai.generateReport({
        userId,
        nickname: user.nickname,
        date,
        stats,
      });
    } catch {
      content = this.fallbackContent(user.nickname, stats);
    }

    const report = await this.prisma.dailyReport.upsert({
      where: { userId_reportDate: { userId, reportDate: date } },
      create: { userId, reportDate: date, content, stats: JSON.stringify(stats), emailed: false },
      update: { content, stats: JSON.stringify(stats) },
    });

    const sent = await this.mail.send(
      user.email,
      `【学习日报】${date} 你的英语学习小结`,
      this.mail.buildDailyReportHtml({
        nickname: user.nickname,
        date,
        content,
        stats: {
          duration: stats.duration,
          words: wordsReviewed,
          courses: courseCount,
          mastered: masteredWords,
        },
      }),
    );
    if (sent) {
      await this.prisma.dailyReport.update({ where: { id: report.id }, data: { emailed: true } });
    }

    // 实时提醒：日报已生成
    this.gateway.pushStudyTaskDone(userId, {
      type: 'daily-report',
      date,
      reportId: report.id,
      emailed: sent,
      message: '今日学习日报已生成',
    });

    return { ...report, emailed: sent } as unknown as DailyReport;
  }

  /** 每 10 分钟关闭超时未支付订单 */
  async handleCloseExpiredOrders() {
    if (!this.enabled) return;
    await this.order.closeExpiredOrders(30);
  }

  /** 每小时：把到期的单词复习任务通过 WebSocket 提醒在线用户 */
  async handleWordReminder() {
    if (!this.enabled) return;
    const now = new Date();
    const grouped = await this.prisma.word.groupBy({
      by: ['userId'],
      where: { status: { not: 'MASTERED' }, OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }] },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (g._count._all >= 5) {
        this.gateway.pushMessage(g.userId, {
          event: SOCKET_EVENTS.STUDY_TASK_DONE,
          type: 'word-review',
          count: g._count._all,
          message: `你有 ${g._count._all} 个单词待复习`,
        });
      }
    }
  }

  /** 手动触发（管理端「立即生成日报」按钮） */
  async triggerForAll(date?: string) {
    const day = date ?? dayjs().format('YYYY-MM-DD');
    const users = await this.collectActiveUsers(day);
    const results: Array<DailyReport | null> = [];
    for (const u of users) {
      results.push(await this.generateForUser(u.id, day).catch(() => null));
    }
    return { date: day, total: users.length, generated: results.filter(Boolean).length };
  }

  /**
   * 找出当天有学习行为的用户；
   * 若当天无数据，则退化为「近 7 天有行为的用户」，保证日报不至于全空。
   */
  private async collectActiveUsers(date: string) {
    const start = dayjs(date).startOf('day').toDate();
    const end = dayjs(date).endOf('day').toDate();
    const today = await this.prisma.studyRecord.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const ids = today.map((t) => t.userId);
    if (ids.length) {
      return this.prisma.user.findMany({
        where: { id: { in: ids }, status: 'ACTIVE' },
        select: { id: true },
      });
    }
    return this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: 'USER',
        studyRecords: { some: { createdAt: { gte: dayjs(date).subtract(7, 'day').toDate() } } },
      },
      select: { id: true },
      take: 200,
    });
  }

  /** AI 不可用时的兜底日报文案 */
  private fallbackContent(nickname: string, stats: Record<string, any>): string {
    const minutes = Math.round((stats.duration ?? 0) / 60);
    const lines = [
      `${nickname}，今天辛苦了！`,
      '',
      `· 学习时长：${minutes} 分钟（${stats.studyCount ?? 0} 次学习记录）`,
      `· 单词复习：${stats.wordsReviewed ?? 0} 个`,
      `· 已掌握单词：${stats.masteredWords ?? 0} 个`,
      '',
      minutes >= 30
        ? '保持这个节奏，你已经超过大多数坚持者了。建议明天把新学的单词再过一遍。'
        : '今天的学习量偏少，试着明天安排 20 分钟的固定学习时段，坚持一周就会形成习惯。',
      '',
      '继续加油，我们明天见 👋',
    ];
    return lines.join('\n');
  }
}
