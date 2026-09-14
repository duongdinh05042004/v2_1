import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthGuard } from '../common/auth.guard';
import { resolveAdminHtml } from './resolve-admin-html';
import { loadAppConfig } from '../core/configuration';
import { MappingConfig, SyncDirection } from '../core/types';
import { GoogleAuthService } from '../google/google-auth.service';
import { MappingService } from '../sync/mapping.service';
import { SyncLoggerService } from '../sync/sync-logger.service';
import { SyncService } from '../sync/sync.service';

@Controller()
export class AdminController {
  constructor(
    private readonly sync: SyncService,
    private readonly mapping: MappingService,
    private readonly logs: SyncLoggerService,
    private readonly googleAuth: GoogleAuthService,
  ) {}

  @Get()
  home(@Res() res: Response): void {
    res.sendFile(resolveAdminHtml());
  }

  @Get('api/health')
  health() {
    const config = loadAppConfig();
    return {
      ok: true,
      service: 'sheets-bitrix24-sync',
      direction: config.sync.direction,
      cron: config.sync.cron,
      running: this.sync.isRunning(),
    };
  }

  @Get('api/config')
  @UseGuards(AdminAuthGuard)
  config() {
    const config = loadAppConfig();
    return {
      google: {
        authMode: config.google.authMode,
        sheetId: config.google.sheetId,
        worksheetName: config.google.worksheetName,
      },
      bitrix: {
        authMode: config.bitrix.authMode,
        webhookConfigured: Boolean(config.bitrix.webhookUrl),
        batchSize: config.bitrix.batchSize,
      },
      sync: config.sync,
      mapping: this.mapping.load(),
    };
  }

  @Post('api/mapping')
  @UseGuards(AdminAuthGuard)
  saveMapping(@Body() body: MappingConfig) {
    return this.mapping.save(body);
  }

  @Post('api/sync/trigger')
  @UseGuards(AdminAuthGuard)
  async trigger(
    @Query('direction') direction?: SyncDirection,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      return await this.sync.run(direction, dryRun === 'true' || dryRun === '1');
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
  }

  @Get('api/sync/status')
  @UseGuards(AdminAuthGuard)
  status() {
    return this.sync.getStatus();
  }

  @Get('api/logs')
  @UseGuards(AdminAuthGuard)
  listLogs(@Query('limit') limit?: string) {
    return this.logs.listRecent(limit ? Number(limit) : 20);
  }

  @Get('auth/google')
  googleAuthStart(@Res() res: Response): void {
    res.redirect(this.googleAuth.getAuthUrl());
  }

  @Get('auth/google/callback')
  async googleAuthCallback(@Query('code') code: string) {
    await this.googleAuth.exchangeCode(code);
    return { ok: true, message: 'Đã lưu Google OAuth token. Có thể đóng tab này.' };
  }
}
