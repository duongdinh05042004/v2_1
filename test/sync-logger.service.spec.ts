import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SyncLoggerService } from '../src/sync/sync-logger.service';
import { SyncRunResult } from '../src/core/types';

function sample(runId: string): SyncRunResult {
  return {
    runId,
    startedAt: '2026-09-13T01:00:00.000Z',
    finishedAt: '2026-09-13T01:00:01.000Z',
    direction: 'one_way',
    dryRun: false,
    counters: { created: 1, updated: 0, skipped: 0, errors: 0, pulled: 0 },
    records: [],
  };
}

describe('SyncLoggerService', () => {
  it('ghi jsonl và đọc lại', () => {
    const dir = mkdtempSync(join(tmpdir(), 'logs-'));
    process.env.LOG_DIR = dir;
    const logger = new SyncLoggerService();
    logger.persist(sample('a'));
    logger.persist(sample('b'));
    const recent = logger.listRecent(10);
    expect(recent).toHaveLength(2);
    expect(logger.summarize(sample('a'))).toContain('created=1');
  });

  it('read/write state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'state-'));
    process.env.LOG_DIR = dir;
    const logger = new SyncLoggerService();
    const file = join(dir, 'state.json');
    expect(logger.readState(file, { ok: false })).toEqual({ ok: false });
    logger.writeState(file, { ok: true });
    expect(logger.readState(file, { ok: false })).toEqual({ ok: true });
  });
});
