import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SyncDirection } from './core/types';
import { SyncService } from './sync/sync.service';

loadEnv();

async function main(): Promise<void> {
  const program = new Command();
  program.name('sheets-bitrix-sync').description('CLI đồng bộ Google Sheets ↔ Bitrix24');

  program
    .command('sync')
    .description('Chạy đồng bộ ngay lập tức')
    .option('-d, --direction <direction>', 'one_way | two_way')
    .option('--dry-run', 'Chỉ mô phỏng, không ghi dữ liệu', false)
    .action(async (opts: { direction?: SyncDirection; dryRun?: boolean }) => {
      const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
      const sync = app.get(SyncService);
      const result = await sync.run(opts.direction, opts.dryRun);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
      await app.close();
    });

  program
    .command('status')
    .description('Xem trạng thái các lần chạy gần nhất')
    .action(async () => {
      const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
      const sync = app.get(SyncService);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(sync.getStatus(), null, 2));
      await app.close();
    });

  await program.parseAsync(process.argv);
}

void main();
