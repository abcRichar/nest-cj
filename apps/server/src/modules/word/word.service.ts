import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  BatchReviewDto,
  CreateWordBookDto,
  CreateWordDto,
  ImportWordsDto,
  UpdateWordDto,
  WordQueryDto,
  WordReviewDto,
} from './dto/word.dto';
import { WordStatus, calcReviewInterval, normalizePage, type WordReviewResult } from '@elp/shared';
import dayjs from 'dayjs';

@Injectable()
export class WordService {
  constructor(private readonly prisma: PrismaService) {}

  /* ============================ 单词本 ============================ */

  async listBooks(userId: number) {
    const books = await this.prisma.wordBook.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { words: true } },
      },
    });

    // 各词本掌握数一次性聚合
    const mastered = await this.prisma.word.groupBy({
      by: ['bookId'],
      where: { userId, status: WordStatus.MASTERED },
      _count: { _all: true },
    });
    const masteredMap = new Map(mastered.map((m) => [m.bookId, m._count._all]));

    return books.map((b) => ({
      id: b.id,
      userId: b.userId,
      name: b.name,
      description: b.description,
      isDefault: b.isDefault,
      total: b._count.words,
      mastered: masteredMap.get(b.id) ?? 0,
      createdAt: b.createdAt,
    }));
  }

  async createBook(userId: number, dto: CreateWordBookDto) {
    const isFirst = (await this.prisma.wordBook.count({ where: { userId } })) === 0;
    return this.prisma.wordBook.create({
      data: { userId, name: dto.name, description: dto.description, isDefault: isFirst },
    });
  }

  async updateBook(userId: number, id: number, dto: CreateWordBookDto) {
    await this.assertBookOwner(userId, id);
    return this.prisma.wordBook.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
    });
  }

  async removeBook(userId: number, id: number) {
    const book = await this.assertBookOwner(userId, id);
    if (book.isDefault) throw new BadRequestException('默认单词本不可删除');
    await this.prisma.wordBook.delete({ where: { id } });
    return { success: true };
  }

  /* ============================ 单词 ============================ */

  async listWords(userId: number, query: WordQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.WordWhereInput = {
      userId,
      ...(query.bookId ? { bookId: query.bookId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword
        ? { OR: [{ word: { contains: query.keyword } }, { translation: { contains: query.keyword } }] }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.word.findMany({ where, orderBy: { id: 'desc' }, skip, take }),
      this.prisma.word.count({ where }),
    ]);
    return { list: rows.map(this.toWordVo), total, page, pageSize };
  }

  async createWord(userId: number, dto: CreateWordDto) {
    await this.assertBookOwner(userId, dto.bookId);
    const { tags, ...rest } = dto;
    const created = await this.prisma.word.create({
      data: {
        ...rest,
        word: dto.word.trim(),
        userId,
        tags: tags ? JSON.stringify(tags) : null,
        nextReviewAt: new Date(),
      },
    });
    return this.toWordVo(created);
  }

  async updateWord(userId: number, id: number, dto: UpdateWordDto) {
    await this.assertWordOwner(userId, id);
    const { tags, ...rest } = dto;
    const updated = await this.prisma.word.update({
      where: { id },
      data: { ...rest, ...(tags ? { tags: JSON.stringify(tags) } : {}) },
    });
    return this.toWordVo(updated);
  }

  async removeWord(userId: number, id: number) {
    await this.assertWordOwner(userId, id);
    await this.prisma.word.delete({ where: { id } });
    return { success: true };
  }

  async batchRemoveWords(userId: number, ids: number[]) {
    const res = await this.prisma.word.deleteMany({ where: { userId, id: { in: ids } } });
    return { deleted: res.count };
  }

  async importWords(userId: number, dto: ImportWordsDto) {
    await this.assertBookOwner(userId, dto.bookId);
    const data = dto.words
      .filter((w) => w.word?.trim() && w.translation?.trim())
      .map((w) => ({
        bookId: dto.bookId,
        userId,
        word: w.word.trim(),
        phonetic: w.phonetic ?? null,
        translation: w.translation.trim(),
        example: w.example ?? null,
        exampleZh: w.exampleZh ?? null,
        tags: w.tags ? JSON.stringify(w.tags) : null,
        status: WordStatus.NEW,
        nextReviewAt: new Date(),
      }));
    if (!data.length) throw new BadRequestException('没有可导入的单词');

    const res = await this.prisma.word.createMany({ data, skipDuplicates: true });
    return { imported: res.count, skipped: data.length - res.count };
  }

  /* ============================ 复习（艾宾浩斯） ============================ */

  /** 获取今日待复习队列 */
  async todayQueue(userId: number, limit = 20) {
    const now = new Date();
    const list = await this.prisma.word.findMany({
      where: {
        userId,
        status: { not: WordStatus.MASTERED },
        OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
      },
      orderBy: [{ nextReviewAt: 'asc' }, { reviewCount: 'asc' }],
      take: limit,
    });
    return { total: list.length, list: list.map(this.toWordVo) };
  }

  /**
   * 提交复习结果：
   *  答对  -> reviewCount+1，按遗忘曲线排下一次复习；连续答对 5 次判定为已掌握
   *  答错  -> reviewCount 归零重来，24h 后必须再复习
   */
  async review(userId: number, dto: WordReviewDto): Promise<WordReviewResult> {
    const word = await this.assertWordOwner(userId, dto.wordId);
    const result = await this.applyReview(word, dto.correct, dto.cost ?? 0);
    return result;
  }

  async batchReview(userId: number, dto: BatchReviewDto) {
    const results: WordReviewResult[] = [];
    for (const item of dto.items ?? []) {
      const word = await this.prisma.word.findFirst({ where: { id: item.wordId, userId } });
      if (!word) continue;
      results.push(await this.applyReview(word, item.correct, item.cost ?? 0));
    }
    return { count: results.length, results };
  }

  private async applyReview(
    word: { id: number; reviewCount: number; correctCount: number },
    correct: boolean,
    cost: number,
  ): Promise<WordReviewResult> {
    const reviewCount = correct ? word.reviewCount + 1 : 0;
    const correctCount = correct ? word.correctCount + 1 : word.correctCount;
    const intervalDays = correct ? calcReviewInterval(reviewCount) : 1;

    // 连续答对 5 次 -> 已掌握
    const masteredThreshold = 5;
    let status: WordStatus = WordStatus.LEARNING;
    if (correct && reviewCount >= masteredThreshold) status = WordStatus.MASTERED;
    else if (!correct) status = WordStatus.LEARNING;

    const nextReviewAt = dayjs().add(intervalDays, 'day').toDate();

    await this.prisma.$transaction([
      this.prisma.word.update({
        where: { id: word.id },
        data: { reviewCount, correctCount, status, nextReviewAt, lastReviewAt: new Date() },
      }),
      this.prisma.wordReviewLog.create({
        data: { wordId: word.id, userId: (word as any).userId, correct, cost },
      }),
    ]);

    return { wordId: word.id, status, reviewCount, nextReviewAt: nextReviewAt.toISOString(), intervalDays };
  }

  /* ============================ 统计 ============================ */

  async stats(userId: number) {
    const [total, byStatus, todayReviewed] = await Promise.all([
      this.prisma.word.count({ where: { userId } }),
      this.prisma.word.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      this.prisma.wordReviewLog.count({
        where: { userId, createdAt: { gte: dayjs().startOf('day').toDate() } },
      }),
    ]);

    const map = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    const now = new Date();
    const due = await this.prisma.word.count({
      where: { userId, status: { not: WordStatus.MASTERED }, OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }] },
    });

    return {
      total,
      new: map[WordStatus.NEW] ?? 0,
      learning: map[WordStatus.LEARNING] ?? 0,
      mastered: map[WordStatus.MASTERED] ?? 0,
      due,
      todayReviewed,
      /** 掌握率（%） */
      masteryRate: total ? Math.round(((map[WordStatus.MASTERED] ?? 0) / total) * 100) : 0,
    };
  }

  /* ============================ 内部 ============================ */

  private async assertBookOwner(userId: number, bookId: number) {
    const book = await this.prisma.wordBook.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new NotFoundException('单词本不存在');
    return book;
  }

  private async assertWordOwner(userId: number, wordId: number) {
    const word = await this.prisma.word.findFirst({ where: { id: wordId, userId } });
    if (!word) throw new NotFoundException('单词不存在');
    return word;
  }

  private toWordVo = (w: any) => ({
    id: w.id,
    bookId: w.bookId,
    userId: w.userId,
    word: w.word,
    phonetic: w.phonetic,
    translation: w.translation,
    example: w.example,
    exampleZh: w.exampleZh,
    audioUrl: w.audioUrl,
    tags: this.parseTags(w.tags),
    status: w.status,
    reviewCount: w.reviewCount,
    correctCount: w.correctCount,
    nextReviewAt: w.nextReviewAt,
    createdAt: w.createdAt,
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
