import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CategoryDto,
  CourseQueryDto,
  CreateChapterDto,
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
} from './dto/course.dto';
import { PublishStatus, normalizePage } from '@elp/shared';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  /* ============================ 用户端 ============================ */

  /** 课程列表（已发布） */
  async listPublic(query: CourseQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CourseWhereInput = {
      status: PublishStatus.PUBLISHED,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.keyword
        ? {
            OR: [
              { title: { contains: query.keyword } },
              { subtitle: { contains: query.keyword } },
              { teacher: { contains: query.keyword } },
            ],
          }
        : {}),
    };

    const orderBy = this.resolveOrderBy(query.sortBy);

    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      list: rows.map(this.toCourseVo),
      total,
      page,
      pageSize,
    };
  }

  /** 课程详情 + 章节课时 + 当前用户学习进度 */
  async detail(id: number, userId?: number) {
    const course = await this.prisma.course.findFirst({
      where: { id, status: PublishStatus.PUBLISHED },
      include: {
        category: { select: { id: true, name: true } },
        chapters: {
          orderBy: { sort: 'asc' },
          include: { lessons: { orderBy: { sort: 'asc' } } },
        },
      },
    });
    if (!course) throw new NotFoundException('课程不存在或已下架');

    let purchased = false;
    let progress = 0;
    let lastLessonId: number | null = null;

    if (userId) {
      const uc = await this.prisma.userCourse.findUnique({
        where: { userId_courseId: { userId, courseId: id } },
      });
      purchased = Boolean(uc);
      progress = uc?.progress ?? 0;
      lastLessonId = uc?.lastLessonId ?? null;
    }

    return {
      ...this.toCourseVo(course),
      description: course.description,
      chapters: course.chapters,
      purchased,
      progress,
      lastLessonId,
    };
  }

  /** 课程分类（带课程数） */
  async categories() {
    const list = await this.prisma.courseCategory.findMany({
      orderBy: { sort: 'asc' },
      include: {
        _count: { select: { courses: { where: { status: PublishStatus.PUBLISHED } } } },
      },
    });
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      sort: c.sort,
      courseCount: c._count.courses,
    }));
  }

  /** 我的课程（已购） */
  async myCourses(userId: number) {
    const rows = await this.prisma.userCourse.findMany({
      where: { userId },
      orderBy: [{ lastStudyAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        course: { include: { category: { select: { id: true, name: true } } } },
      },
    });
    return rows.map((uc) => ({
      courseId: uc.courseId,
      course: this.toCourseVo(uc.course),
      progress: uc.progress,
      lastLessonId: uc.lastLessonId,
      lastStudyAt: uc.lastStudyAt,
      expireAt: uc.expireAt,
    }));
  }

  /** 校验用户是否已购买（用于播放鉴权） */
  async assertPurchased(userId: number, courseId: number) {
    const uc = await this.prisma.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return Boolean(uc);
  }

  /* ============================ 管理端 ============================ */

  async adminList(query: CourseQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.CourseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.keyword
        ? { OR: [{ title: { contains: query.keyword } }, { teacher: { contains: query.keyword } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { orders: true, lessons: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);
    return {
      list: rows.map((r) => ({
        ...this.toCourseVo(r),
        sales: r._count.orders,
        lessonCount: r._count.lessons,
      })),
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateCourseDto) {
    const { tags, ...rest } = dto;
    return this.prisma.course.create({
      data: {
        ...rest,
        tags: tags ? JSON.stringify(tags) : null,
        lessonCount: 0,
      },
    });
  }

  async update(id: number, dto: UpdateCourseDto) {
    await this.ensureExists(id);
    const { tags, ...rest } = dto;
    return this.prisma.course.update({
      where: { id },
      data: { ...rest, ...(tags ? { tags: JSON.stringify(tags) } : {}) },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const paidCount = await this.prisma.order.count({
      where: { courseId: id, status: 'PAID' },
    });
    if (paidCount > 0) {
      // 有已售订单则改为下架，避免影响学习记录
      await this.prisma.course.update({ where: { id }, data: { status: PublishStatus.OFFLINE } });
      return { deleted: false, offline: true, message: '课程已有售出记录，已改为下架处理' };
    }
    await this.prisma.course.delete({ where: { id } });
    return { deleted: true, offline: false };
  }

  async changeStatus(id: number, status: PublishStatus) {
    await this.ensureExists(id);
    return this.prisma.course.update({ where: { id }, data: { status } });
  }

  /* ------------------------- 章节 / 课时 ------------------------- */

  async addChapter(courseId: number, dto: CreateChapterDto) {
    await this.ensureExists(courseId);
    return this.prisma.courseChapter.create({
      data: { courseId, title: dto.title, sort: dto.sort ?? 0 },
    });
  }

  async updateChapter(chapterId: number, dto: CreateChapterDto) {
    return this.prisma.courseChapter.update({
      where: { id: chapterId },
      data: { title: dto.title, sort: dto.sort ?? 0 },
    });
  }

  async removeChapter(chapterId: number) {
    const chapter = await this.prisma.courseChapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('章节不存在');
    await this.prisma.courseChapter.delete({ where: { id: chapterId } });
    await this.syncLessonCount(chapter.courseId);
    return { success: true };
  }

  async addLesson(courseId: number, chapterId: number, dto: CreateLessonDto) {
    await this.ensureExists(courseId);
    const lesson = await this.prisma.courseLesson.create({
      data: {
        courseId,
        chapterId,
        title: dto.title,
        videoUrl: dto.videoUrl,
        duration: dto.duration ?? 0,
        isFree: dto.isFree ?? false,
        sort: dto.sort ?? 0,
      },
    });
    await this.syncLessonCount(courseId);
    return lesson;
  }

  async updateLesson(lessonId: number, dto: CreateLessonDto) {
    const lesson = await this.prisma.courseLesson.update({
      where: { id: lessonId },
      data: { ...dto },
    });
    await this.syncLessonCount(lesson.courseId);
    return lesson;
  }

  async removeLesson(lessonId: number) {
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('课时不存在');
    await this.prisma.courseLesson.delete({ where: { id: lessonId } });
    await this.syncLessonCount(lesson.courseId);
    return { success: true };
  }

  /* ------------------------- 分类 ------------------------- */

  async createCategory(dto: CategoryDto) {
    return this.prisma.courseCategory.create({ data: { name: dto.name, sort: dto.sort ?? 0 } });
  }

  async updateCategory(id: number, dto: CategoryDto) {
    return this.prisma.courseCategory.update({
      where: { id },
      data: { name: dto.name, sort: dto.sort ?? 0 },
    });
  }

  async removeCategory(id: number) {
    const count = await this.prisma.course.count({ where: { categoryId: id } });
    if (count > 0) throw new NotFoundException('该分类下还有课程，无法删除');
    await this.prisma.courseCategory.delete({ where: { id } });
    return { success: true };
  }

  /* ------------------------- 内部 ------------------------- */

  private resolveOrderBy(sortBy?: string): Prisma.CourseOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'hot':
        return [{ studentCount: 'desc' }, { id: 'desc' }];
      case 'price_asc':
        return [{ price: 'asc' }, { id: 'desc' }];
      case 'price_desc':
        return [{ price: 'desc' }, { id: 'desc' }];
      case 'latest':
      default:
        return [{ sort: 'asc' }, { id: 'desc' }];
    }
  }

  /** 总时长 / 课时数由子表汇总，避免维护两处数据 */
  private async syncLessonCount(courseId: number) {
    const agg = await this.prisma.courseLesson.aggregate({
      where: { courseId },
      _count: { _all: true },
      _sum: { duration: true },
    });
    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        lessonCount: agg._count._all,
        duration: agg._sum.duration ?? 0,
      },
    });
  }

  private async ensureExists(id: number) {
    const exists = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('课程不存在');
  }

  private toCourseVo = (c: any) => ({
    id: c.id,
    title: c.title,
    subtitle: c.subtitle,
    cover: c.cover,
    description: c.description,
    price: c.price,
    originalPrice: c.originalPrice,
    level: c.level,
    categoryId: c.categoryId,
    categoryName: c.category?.name ?? null,
    teacher: c.teacher,
    duration: c.duration,
    lessonCount: c.lessonCount,
    studentCount: c.studentCount,
    rating: Number(c.rating ?? 5),
    tags: this.parseTags(c.tags),
    status: c.status,
    sort: c.sort,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  });

  private parseTags(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
}
