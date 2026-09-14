import { SyncScheduler } from '../src/sync/sync.scheduler';

describe('SyncScheduler', () => {
  it('bỏ qua tick khi job đang chạy', async () => {
    const sync = { isRunning: () => true, run: jest.fn() };
    const scheduler = new SyncScheduler(sync as never);
    await scheduler.handleCron();
    expect(sync.run).not.toHaveBeenCalled();
  });

  it('gọi sync.run khi rảnh', async () => {
    const sync = {
      isRunning: () => false,
      run: jest.fn().mockResolvedValue({ counters: { created: 0, updated: 0, errors: 0 } }),
    };
    const scheduler = new SyncScheduler(sync as never);
    await scheduler.handleCron();
    expect(sync.run).toHaveBeenCalled();
  });
});
