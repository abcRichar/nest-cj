import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import {
  ConversationQueryDto,
  CreateConversationDto,
  MessageQueryDto,
  SendMessageDto,
} from './dto/chat.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('AI 对话')
@Controller('chat')
@AuthScope('user')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Public()
  @Get('roles')
  @ApiOperation({ summary: 'AI 角色列表' })
  roles() {
    return this.chat.listRoles();
  }

  /* ------------------------- 会话 ------------------------- */

  @Get('conversations')
  @ApiOperation({ summary: '我的会话列表' })
  conversations(@CurrentUser('sub') userId: number, @Query() query: ConversationQueryDto) {
    return this.chat.listConversations(userId, query);
  }

  @Post('conversations')
  @ApiOperation({ summary: '新建会话' })
  createConversation(@CurrentUser('sub') userId: number, @Body() dto: CreateConversationDto) {
    return this.chat.createConversation(userId, dto);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: '会话详情' })
  detail(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.chat.conversationDetail(userId, id);
  }

  @Put('conversations/:id')
  @ApiOperation({ summary: '重命名会话' })
  rename(
    @CurrentUser('sub') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('title') title: string,
  ) {
    return this.chat.renameConversation(userId, id, title);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: '删除会话' })
  remove(@CurrentUser('sub') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.chat.removeConversation(userId, id);
  }

  @Delete('conversations')
  @ApiOperation({ summary: '清空全部会话' })
  clear(@CurrentUser('sub') userId: number) {
    return this.chat.clearConversations(userId);
  }

  /* ------------------------- 消息 ------------------------- */

  @Get('messages')
  @ApiOperation({ summary: '会话消息（分页）' })
  messages(@CurrentUser('sub') userId: number, @Query() query: MessageQueryDto) {
    return this.chat.messages(userId, query);
  }

  /**
   * SSE 流式对话
   * 用 POST + fetch 读取流（前端用 fetch + ReadableStream，而非 EventSource，
   * 因为 EventSource 只支持 GET 且无法带自定义头）
   */
  @Post('stream')
  @ApiOperation({ summary: 'SSE 流式对话' })
  async stream(
    @CurrentUser('sub') userId: number,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ) {
    await this.chat.streamChat(userId, dto, res);
  }

  @Post('once')
  @ApiOperation({ summary: '非流式对话（降级）' })
  once(@CurrentUser('sub') userId: number, @Body() dto: SendMessageDto) {
    return this.chat.chatOnce(userId, dto);
  }
}
