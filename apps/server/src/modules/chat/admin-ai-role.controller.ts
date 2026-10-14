import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { UserRole } from '@elp/shared';

@ApiTags('管理端-AI角色')
@Controller('admin/ai-roles')
@AuthScope('admin')
@Roles(UserRole.ADMIN)
export class AdminAiRoleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '角色列表' })
  async list() {
    const [list, convCount] = await Promise.all([
      this.prisma.aiRole.findMany({ orderBy: { sort: 'asc' } }),
      this.prisma.conversation.groupBy({ by: ['roleId'], _count: { _all: true } }),
    ]);
    const map = new Map(convCount.map((c) => [c.roleId, c._count._all]));
    return list.map((r) => ({ ...r, conversationCount: map.get(r.id) ?? 0 }));
  }

  @Post()
  @ApiOperation({ summary: '新建 AI 角色' })
  create(
    @Body()
    body: {
      code: string;
      name: string;
      avatar?: string;
      description?: string;
      systemPrompt: string;
      greeting: string;
      category?: string;
      enableSearch?: boolean;
      sort?: number;
    },
  ) {
    return this.prisma.aiRole.create({
      data: {
        code: body.code,
        name: body.name,
        avatar: body.avatar,
        description: body.description,
        systemPrompt: body.systemPrompt,
        greeting: body.greeting,
        category: body.category ?? 'general',
        enableSearch: body.enableSearch ?? true,
        sort: body.sort ?? 0,
      },
    });
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑 AI 角色' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) {
    const allow = [
      'name',
      'avatar',
      'description',
      'systemPrompt',
      'greeting',
      'category',
      'enableSearch',
      'enabled',
      'sort',
    ];
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => allow.includes(k)));
    return this.prisma.aiRole.update({ where: { id }, data });
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: '启用 / 停用角色' })
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const role = await this.prisma.aiRole.findUnique({ where: { id } });
    return this.prisma.aiRole.update({
      where: { id },
      data: { enabled: !role?.enabled },
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除 AI 角色' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const used = await this.prisma.conversation.count({ where: { roleId: id } });
    if (used > 0) {
      await this.prisma.aiRole.update({ where: { id }, data: { enabled: false } });
      return { deleted: false, disabled: true, message: `该角色已有 ${used} 个会话，已改为停用` };
    }
    await this.prisma.aiRole.delete({ where: { id } });
    return { deleted: true };
  }

  @Get('conversations')
  @ApiOperation({ summary: '全站会话列表' })
  async conversations(@Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    const p = Math.max(1, Number(page));
    const ps = Math.min(100, Math.max(1, Number(pageSize)));
    const [list, total] = await Promise.all([
      this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (p - 1) * ps,
        take: ps,
        include: {
          user: { select: { id: true, username: true } },
          role: { select: { name: true } },
        },
      }),
      this.prisma.conversation.count(),
    ]);
    return { list, total, page: p, pageSize: ps };
  }
}
