import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CourseLevel, PublishStatus } from '@elp/shared';

export class CourseQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  @IsOptional() @IsString()
  keyword?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  categoryId?: number;

  @IsOptional() @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional() @IsEnum(PublishStatus)
  status?: PublishStatus;

  /** latest | hot | price_asc | price_desc */
  @IsOptional() @IsString()
  sortBy?: string;
}

export class CreateCourseDto {
  @IsNotEmpty({ message: '课程标题不能为空' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional() @IsString() @MaxLength(255)
  subtitle?: string;

  @IsOptional() @IsString()
  cover?: string;

  @IsOptional() @IsString()
  description?: string;

  /** 单位：分 */
  @Type(() => Number) @IsInt() @Min(0)
  price!: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  originalPrice?: number;

  @IsOptional() @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional() @Type(() => Number) @IsInt()
  categoryId?: number;

  @IsOptional() @IsString() @MaxLength(50)
  teacher?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  duration?: number;

  @IsOptional() @IsArray()
  tags?: string[];

  @IsOptional() @IsEnum(PublishStatus)
  status?: PublishStatus;

  @IsOptional() @Type(() => Number) @IsInt()
  sort?: number;
}

export class UpdateCourseDto extends CreateCourseDto {
  @IsOptional() @IsString() @MaxLength(120) declare title: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) declare price: number;
}

export class CreateChapterDto {
  @IsNotEmpty() @IsString() @MaxLength(120)
  title!: string;

  @IsOptional() @Type(() => Number) @IsInt()
  sort?: number;
}

export class CreateLessonDto {
  @IsNotEmpty() @IsString() @MaxLength(120)
  title!: string;

  @IsOptional() @IsString()
  videoUrl?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  duration?: number;

  @IsOptional() @IsBoolean()
  isFree?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  sort?: number;
}

export class CategoryDto {
  @IsNotEmpty() @IsString() @MaxLength(50)
  name!: string;

  @IsOptional() @Type(() => Number) @IsInt()
  sort?: number;
}
