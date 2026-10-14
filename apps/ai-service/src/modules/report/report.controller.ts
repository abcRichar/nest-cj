import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { LlmService } from '../llm/llm.service';
import { Public } from '../../common/internal-token.guard';

export class ReportDto {
  @Type(() => Number) @IsInt() userId!: number;

  @IsNotEmpty() @IsString() nickname!: string;

  @IsNotEmpty() @IsString() date!: string;

  @IsObject() stats!: Record<string, any>;
}

@Controller('ai')
export class ReportController {
  constructor(private readonly llm: LlmService) {}

  @Public()
  @Get('health')
  health() {
    return {
      status: 'UP',
      service: 'elp-ai-service',
      llm: this.llm.configured ? this.llm.modelName : 'mock',
      time: new Date().toISOString(),
    };
  }

  /** 生成学习日报正文 */
  @Post('report')
  async report(@Body() dto: ReportDto) {
    const stats = dto.stats ?? {};
    const prompt = this.buildPrompt(dto.nickname, dto.date, stats);

    let content = '';
    if (this.llm.configured) {
      content = await this.llm.generate(
        `你是一位耐心、专业的英语学习教练。请根据学生的当日学习数据，生成一份简短（200 字以内）、` +
          `有温度、可执行的学习日报。要求：\n` +
          `1. 先用一句话肯定当天的努力（不要浮夸）；\n` +
          `2. 用 3 条以内的要点总结数据表现；\n` +
          `3. 给出 1-2 条明天可执行的具体建议（要具体到动作和时长）；\n` +
          `4. 不要输出 Markdown 标题，不要复述全部原始数据。`,
        prompt,
      );
    }
    if (!content) content = this.fallback(dto.nickname, stats);

    return { code: 0, message: 'success', data: { content } };
  }

  private buildPrompt(nickname: string, date: string, stats: Record<string, any>): string {
    const trend = Array.isArray(stats.trend)
      ? stats.trend.map((t: any) => `${t.date}:${Math.round((t.duration ?? 0) / 60)}分钟`).join('，')
      : '无';
    return [
      `学生昵称：${nickname}`,
      `日期：${date}`,
      `今日学习时长：${Math.round((stats.duration ?? 0) / 60)} 分钟`,
      `今日学习次数：${stats.studyCount ?? 0} 次`,
      `今日复习单词数：${stats.wordsReviewed ?? 0} 个`,
      `累计已购课程：${stats.courseCount ?? 0} 门`,
      `累计掌握单词：${stats.masteredWords ?? 0} 个`,
      `近 7 天学习时长趋势：${trend}`,
      '',
      '请生成今天的日报。',
    ].join('\n');
  }

  private fallback(nickname: string, stats: Record<string, any>): string {
    const minutes = Math.round((stats.duration ?? 0) / 60);
    const words = stats.wordsReviewed ?? 0;
    return [
      `${nickname}，今天坚持学习很棒。`,
      `· 学习时长 ${minutes} 分钟，复习单词 ${words} 个，累计掌握 ${stats.masteredWords ?? 0} 个。`,
      minutes >= 30
        ? `· 建议：明天保持 30 分钟节奏，并把今天新学的单词在睡前再快速过一遍。`
        : `· 建议：明天固定安排 20 分钟学习时段（建议晚饭后），先复习待复习单词再学新课。`,
      `继续加油！`,
    ].join('\n');
  }
}
