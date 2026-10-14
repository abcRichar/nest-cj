import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('AI-Bootstrap');

  const port = config.get<number>('ai.port') ?? 8090;
  const prefix = config.get<string>('ai.apiPrefix') ?? '/api';

  app.setGlobalPrefix(prefix);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(port, '0.0.0.0');
  logger.log(`AI 服务已启动: http://localhost:${port}${prefix}`);
  logger.log(`健康检查:     http://localhost:${port}${prefix}/ai/health`);
}

bootstrap();
