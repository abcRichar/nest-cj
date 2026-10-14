import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateConversationDto {
  @Type(() => Number) @IsInt()
  roleId!: number;

  @IsOptional() @IsString() @MaxLength(120)
  title?: string;
}

export class SendMessageDto {
  @Type(() => Number) @IsInt()
  conversationId!: number;

  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString() @MaxLength(4000)
  content!: string;

  @IsOptional() @IsBoolean()
  enableSearch?: boolean;
}

export class ConversationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize?: number;
}

export class MessageQueryDto extends ConversationQueryDto {
  /** 会话 ID —— 必须显式声明，否则会被 ValidationPipe 的 whitelist 剥离 */
  @Type(() => Number)
  @IsInt()
  conversationId!: number;

  @IsOptional() @Type(() => Number) @IsInt() beforeId?: number;
}
