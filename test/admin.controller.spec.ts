import { AdminController } from '../src/admin/admin.controller';

describe('AdminController', () => {
  const sync = {
    isRunning: jest.fn().mockReturnValue(false),
    run: jest.fn().mockResolvedValue({ counters: { created: 1 } }),
    getStatus: jest.fn().mockReturnValue({ running: false, recent: [] }),
  };
  const mapping = {
    load: jest.fn().mockReturnValue({ version: 1 }),
    save: jest.fn().mockImplementation((body) => body),
  };
  const logs = { listRecent: jest.fn().mockReturnValue([{ runId: '1' }]) };
  const googleAuth = {
    getAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com'),
    exchangeCode: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new AdminController(
    sync as never,
    mapping as never,
    logs as never,
    googleAuth as never,
  );

  it('health', () => {
    const result = controller.health();
    expect(result.ok).toBe(true);
    expect(result.service).toBe('sheets-bitrix24-sync');
  });

  it('trigger dry-run', async () => {
    await controller.trigger('two_way', 'true');
    expect(sync.run).toHaveBeenCalledWith('two_way', true);
  });

  it('save mapping + logs + callback', async () => {
    expect(controller.saveMapping({ version: 3 } as never)).toEqual({ version: 3 });
    expect(controller.listLogs('5')).toEqual([{ runId: '1' }]);
    expect(logs.listRecent).toHaveBeenCalledWith(5);
    await expect(controller.googleAuthCallback('code-1')).resolves.toMatchObject({ ok: true });
  });
});
