import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { loadAppConfig } from '../core/configuration';
import { canUseLiveApis } from '../core/readiness';
import { extractMessage } from '../core/retry.util';
import { runLocalFallback } from './local-fallback';
import {
  AppConfig,
  NormalizedLead,
  RecordLog,
  SyncCounters,
  SyncDirection,
  SyncRunResult,
  SyncState,
} from '../core/types';
import { Bitrix24Service } from '../bitrix24/bitrix24.service';
import { CellPatch, SheetsService } from '../google/sheets.service';
import { ConflictService } from './conflict.service';
import { MappingService } from './mapping.service';
import { SyncLoggerService } from './sync-logger.service';
import { ValidationService } from './validation.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly app: AppConfig;
  private running = false;

  constructor(
    private readonly sheets: SheetsService,
    private readonly bitrix: Bitrix24Service,
    private readonly mapping: MappingService,
    private readonly validation: ValidationService,
    private readonly conflicts: ConflictService,
    private readonly syncLogger: SyncLoggerService,
  ) {
    this.app = loadAppConfig();
  }

  isRunning(): boolean {
    return this.running;
  }

  async run(direction?: SyncDirection, dryRun?: boolean): Promise<SyncRunResult> {
    if (this.running) {
      throw new Error('Một job đồng bộ đang chạy. Vui lòng đợi hoàn tất.');
    }
    this.running = true;
    const startedAt = new Date().toISOString();
    const runDirection = direction ?? this.app.sync.direction;
    const isDry = dryRun ?? this.app.sync.dryRun;
    const counters: SyncCounters = { created: 0, updated: 0, skipped: 0, errors: 0, pulled: 0 };
    const records: RecordLog[] = [];

    try {
      if (process.env.NODE_ENV === 'test' || canUseLiveApis()) {
        await this.pushSheetToBitrix(counters, records, isDry);
        if (runDirection === 'two_way') {
          await this.pullBitrixToSheet(counters, records, isDry);
        }
      } else {
        this.logger.warn(
          'Chưa cấu hình Google/Bitrix — chạy local từ samples/leads-template.csv',
        );
        if (!isDry) {
          runLocalFallback(counters, records);
        }
      }
    } finally {
      this.running = false;
    }

    const result: SyncRunResult = {
      runId: randomUUID(),
      startedAt,
      finishedAt: new Date().toISOString(),
      direction: runDirection,
      dryRun: isDry,
      counters,
      records,
    };
    this.syncLogger.persist(result);
    this.persistState(runDirection);
    return result;
  }

  /**
   * Sheets -> Bitrix24 (MVP bắt buộc).
   */
  private async pushSheetToBitrix(
    counters: SyncCounters,
    records: RecordLog[],
    dryRun: boolean,
  ): Promise<void> {
    const config = this.mapping.load();
    const snapshot = await this.sheets.ensureSystemColumns(this.mapping.systemHeaders(config), [
      config.systemColumns.leadId,
      config.systemColumns.syncHash,
    ]);
    const patches: CellPatch[] = [];
    const pending: NormalizedLead[] = [];

    for (const row of snapshot.rows) {
      const empty = Object.values(row.values).every((value) => !String(value).trim());
      if (empty) {
        continue;
      }

      const issues = this.validation.validateRow(row);
      if (issues.length) {
        counters.errors += 1;
        records.push({
          rowIndex: row.rowIndex,
          action: 'error',
          message: 'Validation failed',
          error: issues.map((issue) => issue.message).join('; '),
        });
        this.queueStatus(patches, config.systemColumns, row.rowIndex, {
          status: 'Lỗi',
          error: issues.map((issue) => issue.message).join('; '),
        });
        continue;
      }

      let lead: NormalizedLead;
      try {
        lead = this.mapping.normalizeRow(row, config);
      } catch (error) {
        counters.errors += 1;
        const message = extractMessage(error);
        records.push({
          rowIndex: row.rowIndex,
          action: 'error',
          message: 'Normalize failed',
          error: message,
        });
        this.queueStatus(patches, config.systemColumns, row.rowIndex, {
          status: 'Lỗi',
          error: message,
        });
        continue;
      }

      if (lead.existingLeadId && lead.previousHash && lead.previousHash === lead.hash) {
        counters.skipped += 1;
        records.push({
          rowIndex: row.rowIndex,
          action: 'skipped',
          leadId: lead.existingLeadId,
          message: 'Không có thay đổi (sync hash trùng)',
        });
        continue;
      }

      pending.push(lead);
    }

    const outcomes = await this.upsertLeads(pending, dryRun);
    for (const outcome of outcomes) {
      if (outcome.action === 'error') {
        counters.errors += 1;
        this.logger.error(`Hàng ${outcome.rowIndex}: ${outcome.error}`);
        records.push({
          rowIndex: outcome.rowIndex,
          action: 'error',
          leadId: outcome.leadId,
          message: 'Bitrix API error',
          error: outcome.error,
        });
        this.queueStatus(patches, config.systemColumns, outcome.rowIndex, {
          status: 'Lỗi',
          error: outcome.error,
        });
        continue;
      }
      counters[outcome.action === 'created' ? 'created' : 'updated'] += 1;
      records.push({
        rowIndex: outcome.rowIndex,
        action: outcome.action,
        leadId: outcome.leadId,
        message: outcome.message,
      });
      this.queueStatus(patches, config.systemColumns, outcome.rowIndex, {
        status: 'Đã đồng bộ',
        leadId: outcome.leadId,
        hash: pending.find((item) => item.rowIndex === outcome.rowIndex)?.hash,
        error: '',
      });
    }

    if (!dryRun) {
      await this.sheets.batchUpdateCells(patches, snapshot.headers);
    }
  }

  /**
   * Dedup + create/update theo batch Bitrix (≤ 50 lệnh / request).
   */
  private async upsertLeads(
    leads: NormalizedLead[],
    dryRun: boolean,
  ): Promise<
    Array<{
      rowIndex: number;
      action: 'created' | 'updated' | 'error';
      leadId?: string;
      message: string;
      error?: string;
    }>
  > {
    const results: Array<{
      rowIndex: number;
      action: 'created' | 'updated' | 'error';
      leadId?: string;
      message: string;
      error?: string;
    }> = [];

    const needLookup = leads.filter((lead) => !lead.existingLeadId);
    const duplicates = await this.resolveDuplicates(needLookup);
    const resolvedId = new Map<number, string>();
    needLookup.forEach((lead, index) => {
      const found = duplicates[index];
      if (found?.ID) {
        resolvedId.set(lead.rowIndex, String(found.ID));
      }
    });

    const mutations: Array<{
      lead: NormalizedLead;
      type: 'add' | 'update';
      id?: string;
    }> = [];

    for (const lead of leads) {
      const duplicateId = resolvedId.get(lead.rowIndex);
      if (lead.existingLeadId) {
        mutations.push({ lead, type: 'update', id: lead.existingLeadId });
      } else if (duplicateId) {
        mutations.push({ lead, type: 'update', id: duplicateId });
      } else {
        mutations.push({ lead, type: 'add' });
      }
    }

    if (dryRun) {
      return mutations.map((item) => ({
        rowIndex: item.lead.rowIndex,
        action: item.type === 'add' ? 'created' : 'updated',
        leadId: item.id ?? 'DRY-RUN',
        message:
          item.type === 'add'
            ? 'Tạo lead mới DRY-RUN'
            : item.lead.existingLeadId
              ? `Cập nhật lead ${item.id}`
              : `Phát hiện trùng (email/phone) → cập nhật lead ${item.id}`,
      }));
    }

    const mutated = await this.mutateLeads(
      mutations.map((item) => ({
        type: item.type,
        id: item.id,
        fields: item.lead.fields,
      })),
    );

    mutations.forEach((item, index) => {
      const result = mutated[index];
      if (!result?.ok) {
        results.push({
          rowIndex: item.lead.rowIndex,
          action: 'error',
          leadId: item.id,
          message: 'Bitrix API error',
          error: result?.error || 'Unknown Bitrix error',
        });
        return;
      }
      const leadId = result.id || item.id || '';
      results.push({
        rowIndex: item.lead.rowIndex,
        action: item.type === 'add' ? 'created' : 'updated',
        leadId,
        message:
          item.type === 'add'
            ? `Tạo lead mới ${leadId}`
            : item.lead.existingLeadId
              ? `Cập nhật lead ${leadId}`
              : `Phát hiện trùng (email/phone) → cập nhật lead ${leadId}`,
      });
    });
    return results;
  }

  private async resolveDuplicates(
    leads: NormalizedLead[],
  ): Promise<Array<{ ID: string } | undefined>> {
    const batch = (
      this.bitrix as Bitrix24Service & {
        findDuplicatesBatch?: (q: Array<{ email?: string; phone?: string }>) => Promise<Array<{ ID: string } | undefined>>;
      }
    ).findDuplicatesBatch;
    if (batch) {
      return batch(leads.map((lead) => ({ email: lead.email, phone: lead.phone })));
    }
    return Promise.all(leads.map((lead) => this.bitrix.findDuplicate(lead.email, lead.phone)));
  }

  private async mutateLeads(
    ops: Array<{ type: 'add' | 'update'; id?: string; fields: Record<string, unknown> }>,
  ): Promise<Array<{ ok: boolean; id?: string; error?: string }>> {
    const batch = (
      this.bitrix as Bitrix24Service & {
        mutateLeadsBatch?: (
          items: Array<{ type: 'add' | 'update'; id?: string; fields: Record<string, unknown> }>,
        ) => Promise<Array<{ ok: boolean; id?: string; error?: string }>>;
      }
    ).mutateLeadsBatch;
    if (batch) {
      return batch(ops);
    }
    const results: Array<{ ok: boolean; id?: string; error?: string }> = [];
    for (const op of ops) {
      try {
        if (op.type === 'update' && op.id) {
          await this.bitrix.updateLead(op.id, op.fields);
          results.push({ ok: true, id: op.id });
        } else {
          const id = await this.bitrix.addLead(op.fields);
          results.push({ ok: true, id });
        }
      } catch (error) {
        results.push({ ok: false, error: extractMessage(error) });
      }
    }
    return results;
  }

  /**
   * Bitrix24 -> Sheets (tính năng nâng cao).
   */
  private async pullBitrixToSheet(
    counters: SyncCounters,
    records: RecordLog[],
    dryRun: boolean,
  ): Promise<void> {
    const config = this.mapping.load();
    const state = this.syncLogger.readState<SyncState>(this.app.syncStateFile, {});
    const snapshot = await this.sheets.ensureSystemColumns(this.mapping.systemHeaders(config), [
      config.systemColumns.leadId,
      config.systemColumns.syncHash,
    ]);
    const byLeadId = new Map<string, (typeof snapshot.rows)[number]>();
    for (const row of snapshot.rows) {
      const id = row.values[config.systemColumns.leadId]?.trim();
      if (id) {
        byLeadId.set(id, row);
      }
    }

    const leads = await this.bitrix.listModifiedSince(state.lastBitrixModifyAt);
    const patches: CellPatch[] = [];
    const newRows: Record<string, string>[] = [];
    let nextRowIndex = snapshot.rows.reduce((max, row) => Math.max(max, row.rowIndex), 1) + 1;
    let latestModify = state.lastBitrixModifyAt;

    for (const lead of leads) {
      const row = byLeadId.get(String(lead.ID));
      if (!row) {
        const mapped = this.mapping.leadToSheetValues(
          lead as unknown as Record<string, unknown>,
          config,
          { allFields: true },
        );
        const created: Record<string, string> = {
          ...mapped,
          [config.systemColumns.leadId]: String(lead.ID),
          [config.systemColumns.syncStatus]: 'Đã đồng bộ',
          [config.systemColumns.lastSyncAt]: new Date().toISOString(),
          [config.systemColumns.errorMessage]: '',
        };
        newRows.push(created);
        counters.pulled += 1;
        records.push({
          rowIndex: nextRowIndex,
          action: 'pulled',
          leadId: String(lead.ID),
          message: `Thêm hàng mới từ Bitrix (ID=${lead.ID})`,
        });
        nextRowIndex += 1;
        if (lead.DATE_MODIFY && (!latestModify || lead.DATE_MODIFY > latestModify)) {
          latestModify = lead.DATE_MODIFY;
        }
        continue;
      }

      const normalized = this.mapping.normalizeRow(row, config);
      const sheetChanged = Boolean(normalized.previousHash && normalized.previousHash !== normalized.hash);
      const winner = this.conflicts.resolve({
        strategy: config.conflictStrategy ?? this.app.sync.conflictStrategy,
        sheetChanged,
        bitrixChanged: true,
        sheetUpdatedAt: normalized.sheetUpdatedAt,
        bitrixUpdatedAt: lead.DATE_MODIFY,
      });

      if (winner === 'sheet') {
        records.push({
          rowIndex: row.rowIndex,
          action: 'skipped',
          leadId: String(lead.ID),
          message: 'Conflict: giữ dữ liệu Sheet (sheet wins / newer)',
        });
        counters.skipped += 1;
        continue;
      }

      const mapped = this.mapping.leadToSheetValues(lead as unknown as Record<string, unknown>, config);
      for (const [column, value] of Object.entries(mapped)) {
        patches.push({ rowIndex: row.rowIndex, column, value });
      }
      this.queueStatus(patches, config.systemColumns, row.rowIndex, {
        status: 'Đã đồng bộ',
        leadId: String(lead.ID),
        hash: this.mapping.normalizeRow(
          { rowIndex: row.rowIndex, values: { ...row.values, ...mapped } },
          config,
        ).hash,
        error: '',
      });
      counters.pulled += 1;
      records.push({
        rowIndex: row.rowIndex,
        action: 'pulled',
        leadId: String(lead.ID),
        message: `Kéo thay đổi từ Bitrix (DATE_MODIFY=${lead.DATE_MODIFY ?? 'n/a'})`,
      });
      if (lead.DATE_MODIFY && (!latestModify || lead.DATE_MODIFY > latestModify)) {
        latestModify = lead.DATE_MODIFY;
      }
    }

    if (!dryRun) {
      await this.sheets.batchUpdateCells(patches, snapshot.headers);
      if (newRows.length && typeof this.sheets.appendRows === 'function') {
        const start = snapshot.rows.reduce((max, row) => Math.max(max, row.rowIndex), 1) + 1;
        await this.sheets.appendRows(newRows, snapshot.headers, start);
      }
      this.syncLogger.writeState(this.app.syncStateFile, {
        ...state,
        lastBitrixModifyAt: latestModify,
        lastTwoWayAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Cập nhật một hàng từ webhook Bitrix real-time.
   */
  async applyBitrixLead(
    leadId: string,
  ): Promise<{ updated: boolean; created?: boolean; rowIndex?: number }> {
    const lead = await this.bitrix.getLead(leadId);
    if (!lead) {
      return { updated: false };
    }
    const config = this.mapping.load();
    const snapshot = await this.sheets.ensureSystemColumns(this.mapping.systemHeaders(config), [
      config.systemColumns.leadId,
      config.systemColumns.syncHash,
    ]);
    const row = snapshot.rows.find(
      (item) => item.values[config.systemColumns.leadId]?.trim() === String(lead.ID),
    );
    const mapped = this.mapping.leadToSheetValues(lead as unknown as Record<string, unknown>, config, {
      allFields: !row,
    });

    if (!row) {
      const start = snapshot.rows.reduce((max, item) => Math.max(max, item.rowIndex), 1) + 1;
      const created: Record<string, string> = {
        ...mapped,
        [config.systemColumns.leadId]: String(lead.ID),
        [config.systemColumns.syncStatus]: 'Đã đồng bộ',
        [config.systemColumns.lastSyncAt]: new Date().toISOString(),
        [config.systemColumns.errorMessage]: '',
      };
      if (typeof this.sheets.appendRows === 'function') {
        await this.sheets.appendRows([created], snapshot.headers, start);
      }
      return { updated: true, created: true, rowIndex: start };
    }

    const patches: CellPatch[] = Object.entries(mapped).map(([column, value]) => ({
      rowIndex: row.rowIndex,
      column,
      value,
    }));
    this.queueStatus(patches, config.systemColumns, row.rowIndex, {
      status: 'Đã đồng bộ',
      leadId: String(lead.ID),
      error: '',
    });
    await this.sheets.batchUpdateCells(patches, snapshot.headers);
    return { updated: true, created: false, rowIndex: row.rowIndex };
  }

  getStatus(): { running: boolean; recent: SyncRunResult[] } {
    return { running: this.running, recent: this.syncLogger.listRecent(10) };
  }

  private queueStatus(
    patches: CellPatch[],
    columns: ReturnType<MappingService['load']>['systemColumns'],
    rowIndex: number,
    payload: { status: string; leadId?: string; hash?: string; error?: string },
  ): void {
    patches.push({ rowIndex, column: columns.syncStatus, value: payload.status });
    patches.push({ rowIndex, column: columns.lastSyncAt, value: new Date().toISOString() });
    patches.push({ rowIndex, column: columns.errorMessage, value: payload.error ?? '' });
    if (payload.leadId) {
      patches.push({ rowIndex, column: columns.leadId, value: payload.leadId });
    }
    if (payload.hash) {
      patches.push({ rowIndex, column: columns.syncHash, value: payload.hash });
    }
  }

  private persistState(direction: SyncDirection): void {
    const current = this.syncLogger.readState<SyncState>(this.app.syncStateFile, {});
    const next: SyncState = {
      ...current,
      lastOneWayAt: new Date().toISOString(),
    };
    if (direction === 'two_way') {
      next.lastTwoWayAt = new Date().toISOString();
    }
    this.syncLogger.writeState(this.app.syncStateFile, next);
  }
}
