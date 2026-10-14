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
import { WordStatus } from '@elp/shared';

export class WordBookQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
  @IsOptional() @IsString() keyword?: string;
}

export class WordQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() bookId?: number;
  @IsOptional() @IsEnum(WordStatus) status?: WordStatus;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class CreateWordBookDto {
  @IsNotEmpty({ message: '单词本名称不能为空' })
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(255)
  description?: string;
}

export class CreateWordDto {
  @Type(() => Number) @IsInt()
  bookId!: number;

  @IsNotEmpty({ message: '单词不能为空' })
  @IsString()
  @MaxLength(80)
  word!: string;

  @IsOptional() @IsString() @MaxLength(80)
  phonetic?: string;

  @IsNotEmpty({ message: '释义不能为空' })
  @IsString()
  @MaxLength(500)
  translation!: string;

  @IsOptional() @IsString() @MaxLength(500)
  example?: string;

  @IsOptional() @IsString() @MaxLength(500)
  exampleZh?: string;

  @IsOptional() @IsString()
  audioUrl?: string;

  @IsOptional() @IsArray()
  tags?: string[];
}

export class UpdateWordDto {
  @IsOptional() @IsString() @MaxLength(80) word?: string;
  @IsOptional() @IsString() @MaxLength(80) phonetic?: string;
  @IsOptional() @IsString() @MaxLength(500) translation?: string;
  @IsOptional() @IsString() @MaxLength(500) example?: string;
  @IsOptional() @IsString() @MaxLength(500) exampleZh?: string;
  @IsOptional() @IsEnum(WordStatus) status?: WordStatus;
  @IsOptional() @IsArray() tags?: string[];
}

export class WordReviewDto {
  @Type(() => Number) @IsInt()
  wordId!: number;

  @IsBoolean()
  correct!: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  cost?: number;
}

/** 批量复习（一次提交一组作答） */
export class BatchReviewDto {
  @IsArray()
  items!: Array<{ wordId: number; correct: boolean; cost?: number }>;
}

/** 批量导入单词 */
export class ImportWordsDto {
  @Type(() => Number) @IsInt()
  bookId!: number;

  @IsOptional() @IsBoolean()
  autoTranslate?: boolean;

  @IsArray()
  words!: Array<{
    word: string;
    translation: string;
    phonetic?: string;
    example?: string;
    exampleZh?: string;
    tags?: string[];
  }>;
}
