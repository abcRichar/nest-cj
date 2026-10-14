import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AgentService } from '../agent/agent.service';

export class ChatStreamDto {
  @IsNotEmpty() @IsString() threadId!: string;

  @Type(() => Number) @IsInt() userId!: number;

  @IsOptional() @IsString() roleCode?: string;

  @IsOptional() @IsString() systemPrompt?: string;

  @IsNotEmpty() @IsString() message!: string;

  @IsOptional() @IsBoolean() enableSearch?: boolean;
}

@Controller('ai')
export class ChatStreamController {
  constructor(private readonly agent: AgentService) {}

  /**
   * SSE 流式对话接口（由主业务服务内部调用，再转发给浏览器）
   * 事件格式：event: delta|tool|usage|done|error + data: JSON
   */
  @Post('chat/stream')
  async stream(@Body() dto: ChatStreamDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const write = (type: string, payload: unknown) => {
      if (res.writableEnded) return;
      res.write(`event: ${type}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      for await (const ev of this.agent.streamChat({
        threadId: dto.threadId,
        userId: dto.userId,
        roleCode: dto.roleCode ?? 'general',
        systemPrompt: dto.systemPrompt ?? '',
        message: dto.message,
        enableSearch: dto.enableSearch ?? true,
      })) {
        write(ev.type, ev);
      }
    } catch (e) {
      write('error', { type: 'error', error: (e as Error).message });
    } finally {
      res.end();
    }
  }

  @Post('chat/stream-sync')
  async streamSync(@Body() dto: ChatStreamDto) {
    let content = '';
    const tools: unknown[] = [];
    for await (const ev of this.agent.streamChat({
      threadId: dto.threadId,
      userId: dto.userId,
      roleCode: dto.roleCode ?? 'general',
      systemPrompt: dto.systemPrompt ?? '',
      message: dto.message,
      enableSearch: dto.enableSearch ?? true,
    })) {
      if (ev.type === 'delta') content += ev.content ?? '';
      if (ev.type === 'tool') tools.push(ev.tool);
    }
    return { code: 0, message: 'success', data: { content, tools } };
  }
}
