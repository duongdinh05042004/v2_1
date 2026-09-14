import { Injectable, Logger } from '@nestjs/common';
import { sheets_v4 } from 'googleapis';
import { loadAppConfig } from '../core/configuration';
import { columnIndexToLetter } from '../core/column.util';
import { withRetry } from '../core/retry.util';
import { AppConfig, SheetRow } from '../core/types';
import { GoogleAuthService } from './google-auth.service';

export interface SheetSnapshot {
  headers: string[];
  rows: SheetRow[];
  headerMap: Map<string, number>;
}

export interface CellPatch {
  rowIndex: number;
  column: string;
  value: string;
}

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);
  private readonly google: AppConfig['google'];
  private readonly retry: { maxAttempts: number; baseDelayMs: number };

  constructor(private readonly auth: GoogleAuthService) {
    const config = loadAppConfig();
    this.google = config.google;
    this.retry = {
      maxAttempts: config.sync.retryMaxAttempts,
      baseDelayMs: config.sync.retryBaseDelayMs,
    };
  }

  async readSheet(): Promise<SheetSnapshot> {
    const sheets = this.auth.getSheetsApi();
    const auth = await this.auth.getClient();
    const range = `'${this.google.worksheetName}'`;

    const response = await withRetry(
      () =>
        sheets.spreadsheets.values.get({
          auth,
          spreadsheetId: this.google.sheetId,
          range,
          valueRenderOption: 'UNFORMATTED_VALUE',
          dateTimeRenderOption: 'FORMATTED_STRING',
        }),
      this.retry,
    );

    const values = (response.data.values ?? []) as string[][];
    if (!values.length) {
      return { headers: [], rows: [], headerMap: new Map() };
    }

    const headers = values[0].map((header) => String(header ?? '').trim());
    const headerMap = new Map(headers.map((header, index) => [header, index]));
    const rows: SheetRow[] = values.slice(1).map((line, offset) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = line[index] !== undefined && line[index] !== null ? String(line[index]) : '';
      });
      return { rowIndex: offset + 2, values: record };
    });

    this.logger.debug(`Đọc ${rows.length} hàng từ worksheet ${this.google.worksheetName}`);
    return { headers, rows, headerMap };
  }

  /**
   * Đảm bảo các cột hệ thống tồn tại, ẩn cột Lead ID / Sync Hash.
   */
  async ensureSystemColumns(required: string[], hidden: string[] = []): Promise<SheetSnapshot> {
    let snapshot = await this.readSheet();
    const missing = required.filter((name) => !snapshot.headerMap.has(name));
    if (missing.length) {
      const nextHeaders = [...snapshot.headers, ...missing];
      await this.updateRange('A1', [nextHeaders]);
      this.logger.log(`Đã thêm cột hệ thống: ${missing.join(', ')}`);
      snapshot = await this.readSheet();
    }
    if (hidden.length) {
      await this.hideColumns(hidden, snapshot.headers);
    }
    const format = this.detectFormat(snapshot);
    this.logger.debug(
      `Format Sheet: header=${format.hasHeader} cols=${format.columnCount} rows=${format.rowCount} types=${format.columnTypes
        .map((item) => `${item.name}:${item.inferred}`)
        .join(',')}`,
    );
    return snapshot;
  }

  /** Ẩn cột theo tên header (Lead ID, Sync Hash). */
  async hideColumns(columnNames: string[], headers: string[]): Promise<void> {
    const indexes = columnNames
      .map((name) => headers.indexOf(name))
      .filter((index) => index >= 0);
    if (!indexes.length) {
      return;
    }
    try {
      const sheets = this.auth.getSheetsApi();
      const auth = await this.auth.getClient();
      const meta = await withRetry(
        () =>
          sheets.spreadsheets.get({
            auth,
            spreadsheetId: this.google.sheetId,
            fields: 'sheets.properties',
          }),
        this.retry,
      );
      const sheet = meta.data.sheets?.find(
        (item) => item.properties?.title === this.google.worksheetName,
      );
      const sheetId = sheet?.properties?.sheetId;
      if (sheetId === undefined || sheetId === null) {
        this.logger.warn(`Không tìm thấy worksheet ${this.google.worksheetName} để ẩn cột`);
        return;
      }
      await withRetry(
        () =>
          sheets.spreadsheets.batchUpdate({
            auth,
            spreadsheetId: this.google.sheetId,
            requestBody: {
              requests: indexes.map((index) => ({
                updateDimensionProperties: {
                  range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: index,
                    endIndex: index + 1,
                  },
                  properties: { hiddenByUser: true },
                  fields: 'hiddenByUser',
                },
              })),
            },
          }),
        this.retry,
      );
    } catch (error) {
      this.logger.warn(`Không ẩn được cột hệ thống: ${error instanceof Error ? error.message : error}`);
    }
  }

  async appendRows(records: Record<string, string>[], headers: string[], startRowIndex: number): Promise<number> {
    if (!records.length) {
      return startRowIndex;
    }
    const values = records.map((record) => headers.map((header) => record[header] ?? ''));
    const sheets = this.auth.getSheetsApi();
    const auth = await this.auth.getClient();
    const range = `'${this.google.worksheetName}'!A${startRowIndex}`;
    await withRetry(
      () =>
        sheets.spreadsheets.values.append({
          auth,
          spreadsheetId: this.google.sheetId,
          range,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values },
        }),
      this.retry,
    );
    return startRowIndex;
  }

  async batchUpdateCells(patches: CellPatch[], headers: string[]): Promise<void> {
    if (!patches.length) {
      return;
    }

    const headerMap = new Map(headers.map((header, index) => [header, index]));
    const data: sheets_v4.Schema$ValueRange[] = [];

    for (const patch of patches) {
      const colIndex = headerMap.get(patch.column);
      if (colIndex === undefined) {
        continue;
      }
      const a1 = `${columnIndexToLetter(colIndex)}${patch.rowIndex}`;
      data.push({
        range: `'${this.google.worksheetName}'!${a1}`,
        values: [[patch.value]],
      });
    }

    if (!data.length) {
      return;
    }

    const sheets = this.auth.getSheetsApi();
    const auth = await this.auth.getClient();
    const chunks = chunk(data, 100);
    for (const part of chunks) {
      await withRetry(
        () =>
          sheets.spreadsheets.values.batchUpdate({
            auth,
            spreadsheetId: this.google.sheetId,
            requestBody: {
              valueInputOption: 'RAW',
              data: part,
            },
          }),
        this.retry,
      );
    }
  }

  async updateRowValues(rowIndex: number, values: Record<string, string>, headers: string[]): Promise<void> {
    const patches = Object.entries(values).map(([column, value]) => ({
      rowIndex,
      column,
      value,
    }));
    await this.batchUpdateCells(patches, headers);
  }

  async updateRange(startCell: string, values: string[][]): Promise<void> {
    const sheets = this.auth.getSheetsApi();
    const auth = await this.auth.getClient();
    const range = `'${this.google.worksheetName}'!${startCell}`;
    await withRetry(
      () =>
        sheets.spreadsheets.values.update({
          auth,
          spreadsheetId: this.google.sheetId,
          range,
          valueInputOption: 'RAW',
          requestBody: { values },
        }),
      this.retry,
    );
  }

  detectFormat(snapshot: SheetSnapshot): {
    hasHeader: boolean;
    columnCount: number;
    rowCount: number;
    columnTypes: Array<{ name: string; inferred: string }>;
  } {
    return {
      hasHeader: snapshot.headers.some((header) => header.length > 0),
      columnCount: snapshot.headers.length,
      rowCount: snapshot.rows.length,
      columnTypes: snapshot.headers.map((name) => ({
        name,
        inferred: inferColumnType(snapshot.rows.map((row) => row.values[name] ?? '')),
      })),
    };
  }
}

function inferColumnType(samples: string[]): string {
  const filled = samples.map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (!filled.length) {
    return 'empty';
  }
  if (filled.every((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) {
    return 'email';
  }
  if (filled.every((item) => item.replace(/\D/g, '').length >= 9)) {
    return 'phone';
  }
  if (filled.every((item) => /^-?[\d.,]+$/.test(item))) {
    return 'number';
  }
  if (filled.every((item) => /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(item))) {
    return 'date';
  }
  return 'string';
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}
