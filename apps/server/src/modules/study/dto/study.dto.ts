import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ReportProgressDto {
  @Type(() => Number) @IsInt() courseId!: number;
  @Type(() => Number) @IsInt() lessonId!: number;

  /** 本次学习时长（秒） */
  @Type(() => Number) @IsInt() @Min(0) duration!: number;

  /** 该课时完成度 0-100 */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) progress?: number;
}

export class StudyQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}
