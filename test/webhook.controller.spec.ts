import { UnauthorizedException } from '@nestjs/common';
import { WebhookController } from '../src/webhook/webhook.controller';

describe('WebhookController', () => {
  it('từ chối token sai', async () => {
    process.env.ADMIN_API_TOKEN = 'hook-secret';
    const sync = { applyBitrixLead: jest.fn() };
    const controller = new WebhookController(sync as never);
    await expect(controller.handleBitrix({ event: 'ONCRMLEADUPDATE' }, 'bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gọi applyBitrixLead khi có ID', async () => {
    delete process.env.ADMIN_API_TOKEN;
    const sync = { applyBitrixLead: jest.fn().mockResolvedValue({ updated: true, rowIndex: 4 }) };
    const controller = new WebhookController(sync as never);
    const result = await controller.handleBitrix({
      event: 'ONCRMLEADUPDATE',
      data: { FIELDS: { ID: '12' } },
    });
    expect(sync.applyBitrixLead).toHaveBeenCalledWith('12');
    expect(result).toMatchObject({ ok: true, updated: true, rowIndex: 4 });
  });

  it('báo thiếu ID', async () => {
    const sync = { applyBitrixLead: jest.fn() };
    const controller = new WebhookController(sync as never);
    const result = await controller.handleBitrix({ event: 'ONCRMLEADADD' });
    expect(result.ok).toBe(false);
  });
});
