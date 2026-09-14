import { SyncService } from '../src/sync/sync.service';
import { ConflictService } from '../src/sync/conflict.service';
import { SheetRow } from '../src/core/types';

describe('Performance — 100+ records', () => {
  it('xử lý 120 hàng: không dừng sớm, đếm đủ created/updated/error', async () => {
    const rows: SheetRow[] = Array.from({ length: 120 }, (_, i) => ({
      rowIndex: i + 2,
      values: {
        'Tên khách hàng': i % 15 === 0 ? '' : `Lead ${i}`,
        Email: i % 15 === 0 ? 'bad' : `user${i}@example.com`,
        'Lead ID Bitrix24': i % 5 === 0 && i % 15 !== 0 ? String(1000 + i) : '',
        'Sync Hash': '',
      },
    }));

    const headers = [
      'Tên khách hàng',
      'Email',
      'Lead ID Bitrix24',
      'Trạng thái đồng bộ',
      'Thời gian đồng bộ cuối',
      'Thông báo lỗi',
      'Sync Hash',
    ];

    const bitrix = {
      addLead: jest.fn().mockImplementation(async () => 'new'),
      updateLead: jest.fn().mockResolvedValue(true),
      findDuplicate: jest.fn().mockResolvedValue(undefined),
      listModifiedSince: jest.fn().mockResolvedValue([]),
      getLead: jest.fn(),
    };

    const mapping = {
      load: () => ({
        version: 1,
        dedupeFields: ['email'],
        systemColumns: {
          leadId: 'Lead ID Bitrix24',
          syncStatus: 'Trạng thái đồng bộ',
          lastSyncAt: 'Thời gian đồng bộ cuối',
          errorMessage: 'Thông báo lỗi',
          syncHash: 'Sync Hash',
        },
        columns: [],
      }),
      systemHeaders: () => headers.slice(2),
      normalizeRow: (row: SheetRow) => ({
        rowIndex: row.rowIndex,
        title: row.values['Tên khách hàng'],
        email: row.values.Email,
        fields: { TITLE: row.values['Tên khách hàng'] },
        hash: `h-${row.rowIndex}`,
        existingLeadId: row.values['Lead ID Bitrix24'] || undefined,
        previousHash: undefined,
      }),
      leadToSheetValues: () => ({}),
    };

    const validation = {
      validateRow: (row: SheetRow) =>
        row.values['Tên khách hàng'] ? [] : [{ field: 'Tên khách hàng', message: 'required' }],
    };

    const service = new SyncService(
      {
        ensureSystemColumns: jest.fn().mockResolvedValue({ headers, rows, headerMap: new Map() }),
        batchUpdateCells: jest.fn().mockResolvedValue(undefined),
        appendRows: jest.fn().mockResolvedValue(122),
      } as never,
      bitrix as never,
      mapping as never,
      validation as never,
      new ConflictService(),
      {
        persist: jest.fn(),
        readState: jest.fn().mockReturnValue({}),
        writeState: jest.fn(),
        listRecent: jest.fn().mockReturnValue([]),
      } as never,
    );

    const started = Date.now();
    const result = await service.run('one_way', false);
    const elapsed = Date.now() - started;

    expect(result.counters.errors).toBe(8);
    expect(result.counters.created + result.counters.updated + result.counters.errors).toBe(120);
    expect(result.counters.created).toBeGreaterThan(70);
    expect(elapsed).toBeLessThan(5000);
    expect(bitrix.addLead.mock.calls.length + bitrix.updateLead.mock.calls.length).toBe(
      result.counters.created + result.counters.updated,
    );
  });
});
