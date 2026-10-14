import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClientService } from '../ai/ai-client.service';
import {
  ConversationQueryDto,
  CreateConversationDto,
  MessageQueryDto,
  SendMessageDto,
} from './dto/chat.dto';
import { autoTitle, normalizePage, type StreamEvent } from '@elp/shared';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
  ) {}

  /* ============================ AI 角色 ============================ */

  async listRoles() {
    return this.prisma.aiRole.findMany({
      where: { enabled: true },
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        avatar: true,
        description: true,
        greeting: true,
        category: true,
        enableSearch: true,
        enabled: true,
        sort: true,
      },
    });
  }

  /* ============================ 会话 ============================ */

  async createConversation(userId: number, dto: CreateConversationDto) {
    const role = await this.prisma.aiRole.findFirst({ where: { id: dto.roleId, enabled: true } });
    if (!role) throw new NotFoundException('AI 角色不存在或已停用');

    return this.prisma.conversation.create({
      data: {
        userId,
        roleId: role.id,
        title: dto.title ?? `与${role.name}的对话`,
      },
    });
  }

  async listConversations(userId: number, query: ConversationQueryDto) {
    const { page, pageSize, skip, take } = normalizePage(query);
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { role: { select: { name: true, avatar: true, code: true } } },
      }),
      this.prisma.conversation.count({ where: { userId } }),
    ]);
    return {
      list: rows.map((c) => ({
        id: c.id,
        userId: c.userId,
        roleId: c.roleId,
        roleName: c.role?.name,
        roleAvatar: c.role?.avatar,
        roleCode: c.role?.code,
        title: c.title,
        lastMessage: c.lastMessage,
        messageCount: c.messageCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async conversationDetail(userId: number, id: number) {
    const c = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { role: true },
    });
    if (!c) throw new NotFoundException('会话不存在');
    return c;
  }

  async renameConversation(userId: number, id: number, title: string) {
    await this.assertConversation(userId, id);
    return this.prisma.conversation.update({ where: { id }, data: { title } });
  }

  async removeConversation(userId: number, id: number) {
    await this.assertConversation(userId, id);
    await this.prisma.conversation.delete({ where: { id } });
    return { success: true };
  }

  async clearConversations(userId: number) {
    const res = await this.prisma.conversation.deleteMany({ where: { userId } });
    return { deleted: res.count };
  }

  async messages(userId: number, query: MessageQueryDto) {
    const conversationId = Number(query.conversationId);
    if (!conversationId) throw new BadRequestException('缺少 conversationId');
    await this.assertConversation(userId, conversationId);

    const { page, pageSize, skip, take } = normalizePage(query);
    const where = {
      conversationId,
      ...(query.beforeId ? { id: { lt: query.beforeId } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
      }),
      this.prisma.message.count({ where }),
    ]);

    return {
      list: rows.reverse().map((m) => ({
        ...m,
        toolCalls: m.toolCalls ? this.safeJson(m.toolCalls) : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /* ============================ 流式对话 ============================ */

  /**
   * SSE 流式对话：
   *   1. 落库用户消息
   *   2. 打开到 AI 服务的 SSE 流
   *   3. 逐事件转发给浏览器，同时累积 assistant 全文与工具轨迹
   *   4. 流结束落库 assistant 消息、更新会话摘要
   */
  async streamChat(userId: number, dto: SendMessageDto, res: Response): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, userId },
      include: { role: true },
    });
    if (!conversation) throw new NotFoundException('会话不存在');

    // SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 关闭 Nginx 缓冲，避免流式被攒包
    res.flushHeaders?.();

    const send = (event: StreamEvent) => {
      if (res.writableEnded) return;
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // 1. 落库用户消息
    const userMsg = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.content,
      },
    });

    const useSearch = dto.enableSearch ?? conversation.role.enableSearch;
    send({ type: 'start', conversationId: conversation.id, messageId: userMsg.id });

    let full = '';
    const toolTraces: any[] = [];
    let usage: StreamEvent['usage'];

    try {
      const upstream = await this.ai.openChatStream({
        threadId: `conv-${conversation.id}`,
        userId,
        roleCode: conversation.role.code,
        systemPrompt: conversation.role.systemPrompt,
        message: dto.content,
        enableSearch: useSearch,
      });

      if (!upstream.ok || !upstream.body) {
        throw new Error(upstream.text || 'AI 服务无响应');
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件块（\n\n）切分
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const dataLine = block
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }

          if (evt.type === 'delta' && evt.content) full += evt.content;
          if (evt.type === 'tool' && evt.tool) this.upsertTrace(toolTraces, evt.tool);
          if (evt.type === 'usage') usage = evt.usage;

          // 原样转发给浏览器
          send({ ...evt, conversationId: conversation.id, messageId: userMsg.id });
        }
      }
    } catch (e) {
      const message = (e as Error).message || 'AI 服务异常';
      this.logger.error(`流式对话失败 conv=${conversation.id}：${message}`);
      send({ type: 'error', conversationId: conversation.id, error: message });
      full = full || `（AI 服务暂时不可用：${message}）`;
    }

    // 4. 落库 assistant 消息
    const assistantMsg = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: full,
        toolCalls: toolTraces.length ? JSON.stringify(toolTraces) : null,
        tokens: usage?.totalTokens ?? null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: full.slice(0, 200),
        messageCount: { increment: 2 },
        // 首轮对话自动用问题命名，避免一屏「新会话」
        ...(conversation.messageCount === 0
          ? { title: autoTitle(dto.content, 18) }
          : {}),
      },
    });

    send({
      type: 'done',
      conversationId: conversation.id,
      messageId: assistantMsg.id,
      usage,
    });
    res.end();
  }

  /** 供非流式（降级）调用：一次性拿到完整回复 */
  async chatOnce(userId: number, dto: SendMessageDto): Promise<{ content: string }> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, userId },
      include: { role: true },
    });
    if (!conversation) throw new NotFoundException('会话不存在');

    await this.prisma.message.create({
      data: { conversationId: conversation.id, role: 'user', content: dto.content },
    });

    const upstream = await this.ai.openChatStream({
      threadId: `conv-${conversation.id}`,
      userId,
      roleCode: conversation.role.code,
      systemPrompt: conversation.role.systemPrompt,
      message: dto.content,
      enableSearch: dto.enableSearch ?? conversation.role.enableSearch,
    });

    let full = '';
    if (upstream.ok && upstream.body) {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const b of blocks) {
          const d = b.split('\n').find((l) => l.startsWith('data:'));
          if (!d) continue;
          try {
            const evt: StreamEvent = JSON.parse(d.slice(5).trim());
            if (evt.type === 'delta' && evt.content) full += evt.content;
          } catch {
            /* ignore */
          }
        }
      }
    }

    const saved = await this.prisma.message.create({
      data: { conversationId: conversation.id, role: 'assistant', content: full },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessage: full.slice(0, 200), messageCount: { increment: 2 } },
    });
    return { content: full, ...{ messageId: saved.id } } as any;
  }

  /* ============================ 内部 ============================ */

  private async assertConversation(userId: number, id: number) {
    const c = await this.prisma.conversation.findFirst({ where: { id, userId } });
    if (!c) throw new NotFoundException('会话不存在');
    return c;
  }

  private upsertTrace(list: any[], trace: any) {
    const idx = list.findIndex((t) => t.name === trace.name && t.status === 'running');
    if (idx >= 0) list[idx] = { ...list[idx], ...trace };
    else list.push(trace);
  }

  private safeJson(raw: string) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
