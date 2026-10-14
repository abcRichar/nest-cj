import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import {
  aiConfig,
  alipayConfig,
  appConfig,
  jwtConfig,
  mailConfig,
  minioConfig,
  scheduleConfig,
} from './config/configuration';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CourseModule } from './modules/course/course.module';
import { WordModule } from './modules/word/word.module';
import { StudyModule } from './modules/study/study.module';
import { OrderModule } from './modules/order/order.module';
import { StorageModule } from './modules/storage/storage.module';
import { MailModule } from './modules/mail/mail.module';
import { TasksModule } from './modules/schedule/tasks.module';
import { ChatModule } from './modules/chat/chat.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { NoticeModule } from './modules/notice/notice.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SignGuard } from './common/guards/sign.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, jwtConfig, aiConfig, alipayConfig, minioConfig, mailConfig, scheduleConfig],
    }),
    ScheduleModule.forRoot(),

    PrismaModule,
    GatewayModule,
    AuthModule,
    UserModule,
    CourseModule,
    WordModule,
    StudyModule,
    OrderModule,
    StorageModule,
    MailModule,
    TasksModule,
    ChatModule,
    NoticeModule,
    DashboardModule,
  ],
  providers: [
    // 认证 -> 签名，顺序不可颠倒
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SignGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
