import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadAppConfig } from './core/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

  const config = loadAppConfig();
  await app.listen(config.port);
  Logger.log(`Admin UI: http://localhost:${config.port}`, 'Bootstrap');
  Logger.log(`Manual sync: POST http://localhost:${config.port}/api/sync/trigger`, 'Bootstrap');
}

void bootstrap();
