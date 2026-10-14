import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@elp/shared';

@ApiTags('管理端-认证')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '管理端登录（仅 ADMIN 角色）' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'admin');
  }

  @AuthScope('admin')
  @Roles(UserRole.ADMIN)
  @Get('profile')
  @ApiOperation({ summary: '管理端当前用户信息' })
  profile(@CurrentUser('sub') userId: number) {
    return this.auth.profile(userId);
  }
}
