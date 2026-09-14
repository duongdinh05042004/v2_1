import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { runLocalFallback } from '../src/sync/local-fallback';
import { RecordLog, SyncCounters } from '../src/core/types';

describe('runLocalFallback', () => {
  const file = join(process.cwd(), 'data', 'local-crm.json');

  afterAll(() => {
    if (existsSync(file)) {
      unlinkSync(file);
    }
  });

  it('tạo lead từ CSV mẫu rồi bỏ qua lần chạy sau', () => {
    if (existsSync(file)) {
      unlinkSync(file);
    }
    const first: SyncCounters = { created: 0, updated: 0, skipped: 0, errors: 0, pulled: 0 };
    const records: RecordLog[] = [];
    runLocalFallback(first, records);
    expect(first.created).toBeGreaterThan(0);
    expect(first.errors).toBe(0);

    const second: SyncCounters = { created: 0, updated: 0, skipped: 0, errors: 0, pulled: 0 };
    runLocalFallback(second, []);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(first.created);
  });
});
