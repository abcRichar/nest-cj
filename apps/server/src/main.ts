import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: 参数签名需要拿到原始字节
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 分片上传会带 base64 大 body，支付宝回调是 urlencoded，需放宽限制
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '25mb' });
  app.useBodyParser('raw', { limit: '25mb' });

  const port = config.get<number>('app.port') ?? 8080;
  const apiPrefix = config.get<string>('app.apiPrefix') ?? '/api';
  const corsOrigin = config.get<string[]>('app.corsOrigin') ?? [];

  app.setGlobalPrefix(apiPrefix, {
    // 静态资源不参与前缀
    exclude: ['/static/(.*)'],
  });

  app.enableCors({
    origin: corsOrigin.includes('*') ? true : corsOrigin,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization,x-sign,x-timestamp,x-nonce',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 本地磁盘存储驱动降级时的静态访问入口
  const storageDir = join(process.cwd(), 'storage');
  if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('英语学习平台 API')
    .setDescription('用户端 / 管理端 全量接口文档')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addTag('认证')
    .addTag('课程')
    .addTag('单词本')
    .addTag('学习进度')
    .addTag('订单')
    .addTag('AI 对话')
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`服务已启动: http://localhost:${port}${apiPrefix}`);
  logger.log(`接口文档:   http://localhost:${port}${apiPrefix}/docs`);
}

bootstrap();
