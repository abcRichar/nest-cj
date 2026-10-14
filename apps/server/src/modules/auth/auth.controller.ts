import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthScope } from '../../common/decorators/auth-scope.decorator';
import { SignedApi } from '../../common/decorators/signed-api.decorator';

@ApiTags('认证')
@Controller('auth')
@AuthScope('user')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户端登录' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto, 'user');
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前登录用户信息' })
  profile(@CurrentUser('sub') userId: number) {
    return this.auth.profile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: '更新个人资料' })
  update(@CurrentUser('sub') userId: number, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  @SignedApi()
  @Put('password')
  @ApiOperation({ summary: '修改密码（需签名）' })
  changePassword(@CurrentUser('sub') userId: number, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }

  @Post('logout')
  @ApiOperation({ summary: '退出登录' })
  logout() {
    // JWT 为无状态，前端清除 token 即可；此处保留接口便于后续接入黑名单
    return { success: true };
  }
}
