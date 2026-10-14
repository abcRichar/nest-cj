import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import {
  AdminUpdateUserDto,
  ResetPasswordDto,
  UpdateUserStatusDto,
  UserQueryDto,
} from './dto/user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { UserRole } from '@elp/shared';

@ApiTags('管理端-用户')
@Controller('admin/users')
@AuthScope('admin')
@Roles(UserRole.ADMIN)
export class AdminUserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @ApiOperation({ summary: '用户列表' })
  list(@Query() query: UserQueryDto) {
    return this.users.list(query);
  }

  @Get('trend')
  @ApiOperation({ summary: '注册趋势' })
  trend(@Query('days') days?: string) {
    return this.users.registerTrend(days ? Number(days) : 14);
  }

  @Get(':id')
  @ApiOperation({ summary: '用户详情' })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.users.detail(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '编辑用户' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminUpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '启用 / 禁用账号' })
  status(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(id, dto.status);
  }

  @Patch(':id/password')
  @ApiOperation({ summary: '重置密码' })
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(id, dto.password);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除用户' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.users.remove(id);
  }
}
