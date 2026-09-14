import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { loadAppConfig } from '../core/configuration';
import { SyncService } from '../sync/sync.service';

/**
 * Nhận outbound webhook Bitrix24 (ONCRMLEADADD / ONCRMLEADUPDATE)
 * để cập nhật Google Sheet ngay, không chờ cron.
 */
@Controller('api/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly sync: SyncService) {}

  @Post('bitrix')
  async handleBitrix(
    @Body() body: Record<string, unknown>,
    @Headers('x-webhook-token') token?: string,
  ) {
    const expected = loadAppConfig().adminApiToken;
    if (expected && token && token !== expected) {
      throw new UnauthorizedException('Webhook token không hợp lệ');
    }

    const event = String(body.event ?? body.EVENT ?? '');
    const data = (body.data ?? body.DATA ?? {}) as Record<string, unknown>;
    const fields = (data.FIELDS ?? data.fields ?? data) as Record<string, unknown>;
    const id = String(fields.ID ?? fields.id ?? '');

    this.logger.log(`Bitrix webhook event=${event} id=${id}`);
    if (!id) {
      return { ok: false, message: 'Thiếu lead ID trong payload' };
    }

    const result = await this.sync.applyBitrixLead(id);
    return { ok: true, event, ...result };
  }
}
