import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { dirname, join } from 'path';
import { loadAppConfig } from '../core/configuration';
import { SyncRunResult } from '../core/types';

@Injectable()
export class SyncLoggerService {
  private readonly logger = new Logger(SyncLoggerService.name);
  private readonly logDir: string;

  constructor() {
    this.logDir = loadAppConfig().logDir;
    mkdirSync(this.logDir, { recursive: true });
  }

  persist(result: SyncRunResult): string {
    const file = join(this.logDir, `sync-${result.startedAt.slice(0, 10)}.jsonl`);
    appendFileSync(file, `${JSON.stringify(result)}\n`, 'utf8');
    this.logger.log(this.summarize(result));
    return file;
  }

  summarize(result: SyncRunResult): string {
    const { created, updated, skipped, errors, pulled } = result.counters;
    return (
      `Sync ${result.runId} [${result.direction}] ` +
      `created=${created} updated=${updated} skipped=${skipped} ` +
      `errors=${errors} pulled=${pulled} dryRun=${result.dryRun}`
    );
  }

  listRecent(limit = 20): SyncRunResult[] {
    if (!existsSync(this.logDir)) {
      return [];
    }
    const files = readdirSync(this.logDir)
      .filter((name) => name.startsWith('sync-') && name.endsWith('.jsonl'))
      .sort()
      .reverse();

    const runs: SyncRunResult[] = [];
    for (const file of files) {
      const lines = readFileSync(join(this.logDir, file), 'utf8')
        .split('\n')
        .filter(Boolean)
        .reverse();
      for (const line of lines) {
        try {
          runs.push(JSON.parse(line) as SyncRunResult);
        } catch {
          // bỏ qua dòng log hỏng
        }
        if (runs.length >= limit) {
          return runs;
        }
      }
    }
    return runs;
  }

  writeState(file: string, state: unknown): void {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  }

  readState<T>(file: string, fallback: T): T {
    if (!existsSync(file)) {
      return fallback;
    }
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as T;
    } catch {
      return fallback;
    }
  }
}
