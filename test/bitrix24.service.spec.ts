import axios from 'axios';
import { Bitrix24Service } from '../src/bitrix24/bitrix24.service';

jest.mock('axios');

describe('Bitrix24Service', () => {
  const post = jest.fn();
  const get = jest.fn();

  beforeEach(() => {
    post.mockReset();
    get.mockReset();
    (axios.create as jest.Mock).mockReturnValue({ post, get });
    process.env.BITRIX_AUTH_MODE = 'webhook';
    process.env.BITRIX_WEBHOOK_URL = 'https://demo.bitrix24.com/rest/1/token/';
    process.env.RETRY_MAX_ATTEMPTS = '2';
    process.env.RETRY_BASE_DELAY_MS = '1';
    process.env.BITRIX_BATCH_PAUSE_MS = '0';
  });

  it('crm.lead.add trả về ID', async () => {
    post.mockResolvedValue({ data: { result: 321 } });
    const service = new Bitrix24Service();
    await expect(service.addLead({ TITLE: 'A' })).resolves.toBe('321');
    expect(post).toHaveBeenCalledWith(
      'https://demo.bitrix24.com/rest/1/token/crm.lead.add.json',
      { fields: { TITLE: 'A' } },
    );
  });

  it('findDuplicate ưu tiên email rồi phone', async () => {
    post
      .mockResolvedValueOnce({ data: { result: [] } })
      .mockResolvedValueOnce({ data: { result: [{ ID: '9', TITLE: 'X' }] } });
    const service = new Bitrix24Service();
    const found = await service.findDuplicate('a@x.com', '0901234567');
    expect(found?.ID).toBe('9');
  });

  it('ném lỗi Bitrix và map QUERY_LIMIT_EXCEEDED = 429', async () => {
    post.mockResolvedValue({
      data: { error: 'QUERY_LIMIT_EXCEEDED', error_description: 'too many' },
    });
    const service = new Bitrix24Service();
    await expect(service.updateLead('1', { TITLE: 'B' })).rejects.toThrow('too many');
  });

  it('getLead nuốt lỗi và trả undefined', async () => {
    post.mockResolvedValue({ data: { error: 'NOT_FOUND', error_description: 'missing' } });
    const service = new Bitrix24Service();
    await expect(service.getLead('404')).resolves.toBeUndefined();
  });

  it('mutateLeadsBatch gom add/update trong một request batch', async () => {
    post.mockResolvedValue({
      data: {
        result: {
          result: { m0: 11, m1: true },
          result_error: {},
        },
      },
    });
    const service = new Bitrix24Service();
    const results = await service.mutateLeadsBatch([
      { type: 'add', fields: { TITLE: 'A' } },
      { type: 'update', id: '5', fields: { TITLE: 'B' } },
    ]);
    expect(results).toEqual([
      { ok: true, id: '11' },
      { ok: true, id: '5' },
    ]);
    expect(post).toHaveBeenCalledWith(
      'https://demo.bitrix24.com/rest/1/token/batch.json',
      expect.objectContaining({ halt: 0 }),
    );
  });

  it('refresh OAuth khi Bitrix trả expired_token', async () => {
    process.env.BITRIX_AUTH_MODE = 'oauth2';
    process.env.BITRIX_OAUTH_DOMAIN = 'demo.bitrix24.com';
    process.env.BITRIX_OAUTH_CLIENT_ID = 'id';
    process.env.BITRIX_OAUTH_CLIENT_SECRET = 'secret';
    process.env.BITRIX_OAUTH_ACCESS_TOKEN = 'old';
    process.env.BITRIX_OAUTH_REFRESH_TOKEN = 'refresh-1';
    post
      .mockResolvedValueOnce({ data: { error: 'expired_token', error_description: 'expired' } })
      .mockResolvedValueOnce({ data: { result: 88 } });
    get.mockResolvedValue({
      data: { access_token: 'new-token', refresh_token: 'refresh-2', expires_in: 3600 },
    });
    const service = new Bitrix24Service();
    await expect(service.addLead({ TITLE: 'Z' })).resolves.toBe('88');
    expect(get).toHaveBeenCalled();
  });
});
