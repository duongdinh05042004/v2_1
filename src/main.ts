import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { createServer } from 'net';
import { AppModule } from './app.module';
import { loadAppConfig } from './core/configuration';

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function findOpenPort(preferred: number): Promise<number> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (await isPortFree(preferred)) {
      return preferred;
    }
    await sleep(250);
  }
  for (let port = preferred + 1; port < preferred + 20; port += 1) {
    if (await isPortFree(port)) {
      Logger.warn(`Cổng ${preferred} đang bận, chuyển sang ${port}`, 'Bootstrap');
      return port;
    }
  }
  throw new Error(`Không tìm được cổng trống từ ${preferred}`);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));

  const preferred = loadAppConfig().port;
  const port = await findOpenPort(preferred);
  await app.listen(port);
  Logger.log(`Admin UI: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Manual sync: POST http://localhost:${port}/api/sync/trigger`, 'Bootstrap');
}

void bootstrap().catch((error) => {
  Logger.error(error instanceof Error ? error.message : error, 'Bootstrap');
  process.exit(1);
});
