import { Body, Controller, Delete, Param, ParseIntPipe, Post, Put, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { UserRole } from '@elp/shared';
import { EventsGateway } from '../gateway/events.gateway';

@ApiTags('管理端-公告')
@Controller('admin/notices')
@AuthScope('admin')
@Roles(UserRole.ADMIN)
export class AdminNoticeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: EventsGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: '公告列表' })
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    const p = Math.max(1, Number(page));
    const ps = Math.min(100, Math.max(1, Number(pageSize)));
    const [list, total] = await Promise.all([
      this.prisma.notice.findMany({ orderBy: { id: 'desc' }, skip: (p - 1) * ps, take: ps }),
      this.prisma.notice.count(),
    ]);
    return { list, total, page: p, pageSize: ps };
  }

  @Post()
  @ApiOperation({ summary: '发布公告（实时广播）' })
  async create(@Body() body: { title: string; content: string; type?: string; published?: boolean }) {
    const notice = await this.prisma.notice.create({
      data: {
        title: body.title,
        content: body.content,
        type: body.type ?? 'SYSTEM',
        published: body.published ?? true,
      },
    });
    if (notice.published) {
      this.gateway.pushSystemNotice({ id: notice.id, title: notice.title, type: notice.type });
    }
    return notice;
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑公告' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Record<string, any>) {
    const allow = ['title', 'content', 'type', 'published'];
    const data = Object.fromEntries(Object.entries(body).filter(([k]) => allow.includes(k)));
    return this.prisma.notice.update({ where: { id }, data });
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除公告' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.prisma.notice.delete({ where: { id } });
    return { success: true };
  }
}
