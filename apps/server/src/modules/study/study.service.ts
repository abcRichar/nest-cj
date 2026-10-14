import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportProgressDto, StudyQueryDto } from './dto/study.dto';
import { normalizePage, type StudyOverview } from '@elp/shared';
import dayjs from 'dayjs';

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 上报学习进度：
   *  - 写 study_record（用于统计与日报）
   *  - 更新 user_course（整体进度 / 最后学习课时 / 最后学习时间）
   */
  async report(userId: number, dto: ReportProgressDto) {
    const course = await this.prisma.course.findUnique({
      where: { id: dto.courseId },
      select: { id: true, lessonCount: true },
    });
    if (!course) throw new NotFoundException('课程不存在');

    await this.prisma.studyRecord.create({
      data: {
        userId,
        courseId: dto.courseId,
        lessonId: dto.lessonId,
        duration: dto.duration,
        progress: dto.progress ?? 0,
      },
    });

    // 整课进度 = 已完成课时数 / 总课时数（按最后一次上报的课时完成度折算）
    const finishedLessons = await this.prisma.studyRecord
      .groupBy({
        by: ['lessonId'],
        where: { userId, courseId: dto.courseId },
      })
      .then((r) => r.length);

    const totalLessons = course.lessonCount || 1;
    const progress = Math.min(100, Math.round((finishedLessons / totalLessons) * 100));

    const uc = await this.prisma.userCourse.upsert({
      where: { userId_courseId: { userId, courseId: dto.courseId } },
      create: {
        userId,
        courseId: dto.courseId,
        progress,
        lastLessonId: dto.lessonId,
        lastStudyAt: new Date(),
      },
      update: {
        progress,
        lastLessonId: dto.lessonId,
        lastStudyAt: new Date(),
      },
    });

    return { progress: uc.progress, lastLessonId: uc.lastLessonId };
  }

  /** 学习总览（个人中心首页） */
  async overview(userId: number): Promise<StudyOverview> {
    const todayStart = dayjs().startOf('day').toDate();
    const weekStart = dayjs().subtract(6, 'day').startOf('day').toDate();

    const [aggAll, aggToday, courseCount, masteredWords, weekRows, distinctDays] = await Promise.all([
      this.prisma.studyRecord.aggregate({ where: { userId }, _sum: { duration: true } }),
      this.prisma.studyRecord.aggregate({
        where: { userId, createdAt: { gte: todayStart } },
        _sum: { duration: true },
      }),
      this.prisma.userCourse.count({ where: { userId } }),
      this.prisma.word.count({ where: { userId, status: 'MASTERED' } }),
      this.prisma.studyRecord.findMany({
        where: { userId, createdAt: { gte: weekStart } },
        select: { createdAt: true, duration: true },
      }),
      this.prisma.studyRecord.findMany({
        where: { userId },
        select: { createdAt: true },
        distinct: ['createdAt'],
      }),
    ]);

    // 近 7 天趋势（按天聚合）
    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) trendMap.set(dayjs().subtract(i, 'day').format('YYYY-MM-DD'), 0);
    for (const r of weekRows) {
      const key = dayjs(r.createdAt).format('YYYY-MM-DD');
      trendMap.set(key, (trendMap.get(key) ?? 0) + r.duration);
    }

    // distinct 是按精确时间去的重，这里再按「天」收敛一次
    const daySet = new Set(distinctDays.map((r) => dayjs(r.createdAt).format('YYYY-MM-DD')));

    return {
      studyDays: daySet.size,
      todayDuration: aggToday._sum.duration ?? 0,
      totalDuration: aggAll._sum.duration ?? 0,
      courseCount,
      masteredWords,
      weekTrend: Array.from(trendMap.entries()).map(([date, duration]) => ({ date, duration })),
    };
  }

  /** 我的学习记录流 */
  async records(userId: number, query: StudyQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const [rows, total] = await Promise.all([
      this.prisma.studyRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.studyRecord.count({ where: { userId } }),
    ]);

    // 补充课程/课时标题
    const courseIds = [...new Set(rows.map((r) => r.courseId))];
    const lessonIds = [...new Set(rows.map((r) => r.lessonId))];
    const [courses, lessons] = await Promise.all([
      this.prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, title: true } }),
      this.prisma.courseLesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } }),
    ]);
    const cMap = new Map(courses.map((c) => [c.id, c.title]));
    const lMap = new Map(lessons.map((l) => [l.id, l.title]));

    return {
      list: rows.map((r) => ({
        ...r,
        courseTitle: cMap.get(r.courseId) ?? '未知课程',
        lessonTitle: lMap.get(r.lessonId) ?? '未知课时',
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 课程内所有课时的完成情况（播放器侧边目录用） */
  async courseProgress(userId: number, courseId: number) {
    const uc = await this.prisma.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    const done = await this.prisma.studyRecord.groupBy({
      by: ['lessonId'],
      where: { userId, courseId },
      _max: { progress: true },
    });
    return {
      courseId,
      progress: uc?.progress ?? 0,
      lastLessonId: uc?.lastLessonId ?? null,
      lessons: done.map((d) => ({ lessonId: d.lessonId, progress: d._max.progress ?? 0 })),
    };
  }
}
