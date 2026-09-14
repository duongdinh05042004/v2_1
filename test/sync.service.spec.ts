import { SyncService } from '../src/sync/sync.service';
import { ConflictService } from '../src/sync/conflict.service';
import { MappingConfig, SheetRow } from '../src/core/types';

const mappingConfig: MappingConfig = {
  version: 1,
  dedupeFields: ['email', 'phone'],
  systemColumns: {
    leadId: 'Lead ID Bitrix24',
    syncStatus: 'Trạng thái đồng bộ',
    lastSyncAt: 'Thời gian đồng bộ cuối',
    errorMessage: 'Thông báo lỗi',
    syncHash: 'Sync Hash',
  },
  columns: [
    { sheet: 'Tên khách hàng', bitrix: 'TITLE', type: 'string', required: true },
    { sheet: 'Email', bitrix: 'EMAIL', type: 'email', required: true, multivalue: true },
    { sheet: 'Số điện thoại', bitrix: 'PHONE', type: 'phone', required: false, multivalue: true },
  ],
  twoWayFields: ['TITLE', 'STATUS_ID'],
};

function row(index: number, values: Record<string, string>): SheetRow {
  return { rowIndex: index, values };
}

function buildService(overrides?: {
  rows?: SheetRow[];
  findDuplicate?: jest.Mock;
  addLead?: jest.Mock;
  updateLead?: jest.Mock;
  listModified?: jest.Mock;
  getLead?: jest.Mock;
}) {
  const headers = [
    'Tên khách hàng',
    'Email',
    'Số điện thoại',
    'Lead ID Bitrix24',
    'Trạng thái đồng bộ',
    'Thời gian đồng bộ cuối',
    'Thông báo lỗi',
    'Sync Hash',
  ];
  const sheets = {
    ensureSystemColumns: jest.fn().mockResolvedValue({
      headers,
      rows: overrides?.rows ?? [],
      headerMap: new Map(headers.map((h, i) => [h, i])),
    }),
    batchUpdateCells: jest.fn().mockResolvedValue(undefined),
    appendRows: jest.fn().mockResolvedValue(20),
  };
  const bitrix = {
    addLead: overrides?.addLead ?? jest.fn().mockResolvedValue('101'),
    updateLead: overrides?.updateLead ?? jest.fn().mockResolvedValue(true),
    findDuplicate: overrides?.findDuplicate ?? jest.fn().mockResolvedValue(undefined),
    listModifiedSince: overrides?.listModified ?? jest.fn().mockResolvedValue([]),
    getLead: overrides?.getLead ?? jest.fn(),
  };
  const realMapping = {
    load: () => mappingConfig,
    systemHeaders: () => Object.values(mappingConfig.systemColumns),
    normalizeRow: (item: SheetRow) => ({
      rowIndex: item.rowIndex,
      title: item.values['Tên khách hàng'],
      email: item.values.Email?.toLowerCase(),
      phone: item.values['Số điện thoại'] || undefined,
      fields: { TITLE: item.values['Tên khách hàng'] },
      hash: item.values['Sync Hash'] === 'same' ? 'same' : `hash-${item.rowIndex}`,
      existingLeadId: item.values['Lead ID Bitrix24'] || undefined,
      previousHash: item.values['Sync Hash'] || undefined,
    }),
    leadToSheetValues: jest.fn().mockReturnValue({ 'Tên khách hàng': 'From Bitrix' }),
  };

  const validation = {
    validateRow: (item: SheetRow) => {
      if (!item.values['Tên khách hàng'] || !item.values.Email?.includes('@')) {
        return [{ field: 'Email', message: 'invalid' }];
      }
      return [];
    },
  };

  const logs = {
    persist: jest.fn(),
    readState: jest.fn().mockReturnValue({}),
    writeState: jest.fn(),
    listRecent: jest.fn().mockReturnValue([]),
  };

  process.env.SYNC_DRY_RUN = 'false';
  process.env.SYNC_DIRECTION = 'one_way';

  const service = new SyncService(
    sheets as never,
    bitrix as never,
    realMapping as never,
    validation as never,
    new ConflictService(),
    logs as never,
  );

  return { service, sheets, bitrix, logs, realMapping };
}

describe('SyncService', () => {
  it('TC1: tạo lead mới và ghi Lead ID', async () => {
    const addLead = jest.fn().mockResolvedValue('555');
    const { service, bitrix, sheets } = buildService({
      addLead,
      rows: [
        row(2, {
          'Tên khách hàng': 'Nguyen Van A',
          Email: 'a@example.com',
          'Lead ID Bitrix24': '',
          'Sync Hash': '',
        }),
      ],
    });

    const result = await service.run('one_way', false);
    expect(result.counters.created).toBe(1);
    expect(bitrix.addLead).toHaveBeenCalled();
    expect(sheets.batchUpdateCells).toHaveBeenCalled();
    const patches = sheets.batchUpdateCells.mock.calls[0][0];
    expect(patches.some((p: { column: string; value: string }) => p.column === 'Lead ID Bitrix24' && p.value === '555')).toBe(true);
    expect(patches.some((p: { value: string }) => p.value === 'Đã đồng bộ')).toBe(true);
  });

  it('TC2: cập nhật lead đã có ID khi hash đổi', async () => {
    const updateLead = jest.fn().mockResolvedValue(true);
    const { service, bitrix } = buildService({
      updateLead,
      rows: [
        row(3, {
          'Tên khách hàng': 'Tran Thi B',
          Email: 'b@example.com',
          'Lead ID Bitrix24': '88',
          'Sync Hash': 'old',
        }),
      ],
    });
    const result = await service.run('one_way');
    expect(result.counters.updated).toBe(1);
    expect(bitrix.updateLead).toHaveBeenCalledWith('88', expect.any(Object));
  });

  it('bỏ qua khi hash không đổi', async () => {
    const { service, bitrix } = buildService({
      rows: [
        row(4, {
          'Tên khách hàng': 'Skip',
          Email: 's@example.com',
          'Lead ID Bitrix24': '9',
          'Sync Hash': 'same',
        }),
      ],
    });
    const result = await service.run('one_way');
    expect(result.counters.skipped).toBe(1);
    expect(bitrix.addLead).not.toHaveBeenCalled();
    expect(bitrix.updateLead).not.toHaveBeenCalled();
  });

  it('TC3: trùng email thì update thay vì tạo mới', async () => {
    const findDuplicate = jest.fn().mockResolvedValue({ ID: '777' });
    const updateLead = jest.fn().mockResolvedValue(true);
    const addLead = jest.fn();
    const { service } = buildService({
      findDuplicate,
      updateLead,
      addLead,
      rows: [
        row(5, {
          'Tên khách hàng': 'Dup',
          Email: 'dup@example.com',
          'Lead ID Bitrix24': '',
        }),
      ],
    });
    const result = await service.run('one_way');
    expect(result.counters.updated).toBe(1);
    expect(result.counters.created).toBe(0);
    expect(addLead).not.toHaveBeenCalled();
    expect(updateLead).toHaveBeenCalledWith('777', expect.any(Object));
    expect(result.records[0].message).toMatch(/trùng/);
  });

  it('TC4: lỗi API một hàng không chặn hàng khác', async () => {
    const addLead = jest
      .fn()
      .mockRejectedValueOnce(new Error('rate limit timeout'))
      .mockResolvedValueOnce('202');
    const { service } = buildService({
      addLead,
      rows: [
        row(6, { 'Tên khách hàng': 'Err', Email: 'e1@example.com' }),
        row(7, { 'Tên khách hàng': 'Ok', Email: 'e2@example.com' }),
      ],
    });
    const result = await service.run('one_way');
    expect(result.counters.errors).toBe(1);
    expect(result.counters.created).toBe(1);
    expect(result.records.find((r) => r.action === 'error')?.error).toMatch(/rate limit/);
  });

  it('validation lỗi được đếm và ghi status Lỗi', async () => {
    const { service } = buildService({
      rows: [row(8, { 'Tên khách hàng': '', Email: 'bad' })],
    });
    const result = await service.run('one_way');
    expect(result.counters.errors).toBe(1);
  });

  it('two-way pull cập nhật sheet khi Bitrix mới hơn', async () => {
    const { service, sheets } = buildService({
      rows: [
        row(9, {
          'Tên khách hàng': 'Old',
          Email: 'p@example.com',
          'Lead ID Bitrix24': '33',
          'Sync Hash': 'same',
        }),
      ],
      listModified: jest.fn().mockResolvedValue([
        { ID: '33', TITLE: 'From Bitrix', DATE_MODIFY: '2026-09-13T12:00:00+07:00', STATUS_ID: 'IN_PROCESS' },
      ]),
    });
    const result = await service.run('two_way', false);
    expect(result.counters.pulled).toBe(1);
    expect(sheets.batchUpdateCells).toHaveBeenCalled();
  });

  it('webhook applyBitrixLead cập nhật đúng hàng', async () => {
    const { service } = buildService({
      rows: [
        row(10, {
          'Tên khách hàng': 'Hook',
          Email: 'h@example.com',
          'Lead ID Bitrix24': '44',
        }),
      ],
      getLead: jest.fn().mockResolvedValue({ ID: '44', TITLE: 'Webhook' }),
    });
    const result = await service.applyBitrixLead('44');
    expect(result).toEqual({ updated: true, created: false, rowIndex: 10 });
  });

  it('two-way thêm hàng mới khi Bitrix có lead chưa có trên Sheet', async () => {
    const { service, sheets } = buildService({
      rows: [],
      listModified: jest.fn().mockResolvedValue([
        { ID: '90', TITLE: 'New from CRM', DATE_MODIFY: '2026-09-13T12:00:00+07:00' },
      ]),
    });
    const result = await service.run('two_way', false);
    expect(result.counters.pulled).toBe(1);
    expect(sheets.appendRows).toHaveBeenCalled();
    expect(result.records[0].message).toMatch(/Thêm hàng mới/);
  });

  it('webhook tạo hàng mới nếu chưa có Lead ID trên Sheet', async () => {
    const { service, sheets } = buildService({
      rows: [],
      getLead: jest.fn().mockResolvedValue({ ID: '91', TITLE: 'Hook new' }),
    });
    const result = await service.applyBitrixLead('91');
    expect(result).toEqual({ updated: true, created: true, rowIndex: 2 });
    expect(sheets.appendRows).toHaveBeenCalled();
  });

  it('chặn chạy song song', async () => {
    const { service } = buildService({
      rows: [
        row(2, {
          'Tên khách hàng': 'A',
          Email: 'a@example.com',
        }),
      ],
    });
    const first = service.run('one_way');
    await expect(service.run('one_way')).rejects.toThrow(/đang chạy/);
    await first;
  });
});
