import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { loadAppConfig } from '../core/configuration';
import { canUseLiveApis } from '../core/readiness';
import { SyncService } from './sync.service';

@Injectable()
export class SyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncScheduler.name);
  private job?: { start: () => void; stop: () => void };

  constructor(private readonly sync: SyncService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const cron = loadAppConfig().sync.cron || '*/15 * * * *';
    // cron được nest schedule phụ thuộc; require tránh xung đột type giữa 2 bản cron.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CronJob } = require('cron') as {
      CronJob: new (expr: string, cb: () => void) => { start: () => void; stop: () => void };
    };
    this.job = new CronJob(cron, () => {
      void this.handleCron();
    });
    this.job.start();
    this.logger.log(`Đã đăng ký lịch đồng bộ: ${cron}`);
  }

  onModuleDestroy(): void {
    this.job?.stop();
  }

  async handleCron(): Promise<void> {
    if (process.env.NODE_ENV !== 'test' && !canUseLiveApis()) {
      this.logger.warn('Bỏ qua lịch: chưa cấu hình Google Sheets / Bitrix24');
      return;
    }
    if (this.sync.isRunning()) {
      this.logger.warn('Bỏ qua tick lịch: job trước vẫn đang chạy');
      return;
    }
    try {
      const result = await this.sync.run();
      this.logger.log(
        `Lịch trình xong: created=${result.counters.created} updated=${result.counters.updated} errors=${result.counters.errors}`,
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : error);
    }
  }
}
