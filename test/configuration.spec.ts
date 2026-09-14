import { loadAppConfig } from '../src/core/configuration';

describe('loadAppConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('dùng giá trị mặc định an toàn', () => {
    delete process.env.PORT;
    delete process.env.BITRIX_BATCH_SIZE;
    const config = loadAppConfig();
    expect(config.port).toBe(3000);
    expect(config.bitrix.batchSize).toBe(50);
    expect(config.sync.direction).toBe('one_way');
  });

  it('đọc env và giới hạn batch size', () => {
    process.env.PORT = '4100';
    process.env.BITRIX_BATCH_SIZE = '99';
    process.env.SYNC_DRY_RUN = 'true';
    process.env.SYNC_DIRECTION = 'two_way';
    const config = loadAppConfig();
    expect(config.port).toBe(4100);
    expect(config.bitrix.batchSize).toBe(50);
    expect(config.sync.dryRun).toBe(true);
    expect(config.sync.direction).toBe('two_way');
  });
});
