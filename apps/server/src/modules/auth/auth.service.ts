import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { aesEncrypt, md5 } from '../../common/utils/crypto.util';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { UserRole, UserStatus, type JwtPayload, type LoginVo } from '@elp/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /* ----------------------------- 注册 ----------------------------- */

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
      select: { id: true, username: true, email: true },
    });
    if (exists) {
      throw new ConflictException(
        exists.username === dto.username ? '用户名已被占用' : '邮箱已被注册',
      );
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        nickname: dto.nickname || dto.username,
        password: hash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(dto.username)}`,
      },
      select: this.publicUserSelect(),
    });

    // 注册后自动创建默认单词本
    const book = await this.prisma.wordBook.create({
      data: { userId: user.id, name: '我的生词本', description: '默认单词本', isDefault: true },
    });
    await this.seedStarterWords(user.id, book.id);

    const token = await this.signToken(user, 'user');
    return { token, expiresIn: this.expiresSeconds(), user };
  }

  /* ----------------------------- 登录 ----------------------------- */

  async login(dto: LoginDto, scope: 'user' | 'admin' = 'user'): Promise<LoginVo> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.account }, { email: dto.account }] },
    });
    if (!user) throw new UnauthorizedException('账号或密码错误');

    const matched = await bcrypt.compare(dto.password, user.password);
    if (!matched) throw new UnauthorizedException('账号或密码错误');

    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenException('账号已被禁用，请联系管理员');
    }
    if (scope === 'admin' && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('该账号无管理端登录权限');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = await this.signToken(user, scope);
    const { password, ...rest } = user;
    return { token, expiresIn: this.expiresSeconds(), user: rest as any };
  }

  /* ----------------------------- 资料 ----------------------------- */

  async profile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect(),
    });
    if (!user) throw new UnauthorizedException('用户不存在');

    const [courseCount, wordCount] = await Promise.all([
      this.prisma.userCourse.count({ where: { userId } }),
      this.prisma.word.count({ where: { userId } }),
    ]);
    return { ...user, courseCount, wordCount };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = { ...dto };
    // 手机号属敏感字段，落库前加密，同时存 md5 便于检索
    if (dto.phone) {
      data.phone = aesEncrypt(dto.phone, this.config.get<string>('jwt.secret')!);
      data.phoneHash = md5(dto.phone);
    }
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: this.publicUserSelect(),
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    const ok = await bcrypt.compare(dto.oldPassword, user.password);
    if (!ok) throw new BadRequestException('原密码不正确');

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(dto.newPassword, 10) },
    });
    return { success: true };
  }

  /* ----------------------------- 内部方法 ----------------------------- */

  private async signToken(user: { id: number; username: string; role: string }, scope: 'user' | 'admin') {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role as UserRole,
      scope,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.expiresIn'),
    });
  }

  private expiresSeconds(): number {
    const raw = this.config.get<string>('jwt.expiresIn') ?? '7d';
    const m = /^(\d+)([smhd])$/.exec(raw);
    if (!m) return 7 * 24 * 3600;
    const n = Number(m[1]);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
    return n * unit;
  }

  private publicUserSelect() {
    return {
      id: true,
      username: true,
      email: true,
      nickname: true,
      avatar: true,
      bio: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    } as const;
  }

  /** 新用户送一组入门单词，避免「空数据」体验 */
  private async seedStarterWords(userId: number, bookId: number) {
    const starter = [
      { word: 'abandon', phonetic: '/əˈbændən/', translation: 'v. 放弃；抛弃', example: 'Never abandon your dream.', exampleZh: '永远不要放弃你的梦想。' },
      { word: 'benefit', phonetic: '/ˈbenɪfɪt/', translation: 'n. 好处 v. 受益', example: 'Reading benefits us a lot.', exampleZh: '阅读让我们受益匪浅。' },
      { word: 'crucial', phonetic: '/ˈkruːʃl/', translation: 'adj. 至关重要的', example: 'Practice is crucial to fluency.', exampleZh: '练习对流畅表达至关重要。' },
      { word: 'diligent', phonetic: '/ˈdɪlɪdʒənt/', translation: 'adj. 勤奋的', example: 'She is a diligent learner.', exampleZh: '她是个勤奋的学习者。' },
      { word: 'efficient', phonetic: '/ɪˈfɪʃnt/', translation: 'adj. 高效的', example: 'Find an efficient way to learn.', exampleZh: '找到高效的学习方法。' },
    ];
    await this.prisma.word.createMany({
      data: starter.map((w) => ({
        ...w,
        bookId,
        userId,
        status: 'NEW',
        tags: '["starter"]',
        nextReviewAt: new Date(),
      })),
      skipDuplicates: true,
    });
    this.logger.log(`用户 ${userId} 已初始化 ${starter.length} 个入门单词`);
  }
}
