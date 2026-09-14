import { SheetsService } from '../src/google/sheets.service';

describe('SheetsService', () => {
  function setup(values: string[][]) {
    const get = jest.fn().mockResolvedValue({ data: { values } });
    const batchUpdate = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({});
    const append = jest.fn().mockResolvedValue({});
    const spreadsheetGet = jest.fn().mockResolvedValue({
      data: { sheets: [{ properties: { title: 'Leads', sheetId: 7 } }] },
    });
    const spreadsheetBatchUpdate = jest.fn().mockResolvedValue({});
    const auth = {
      getClient: jest.fn().mockResolvedValue({}),
      getSheetsApi: jest.fn().mockReturnValue({
        spreadsheets: {
          get: spreadsheetGet,
          batchUpdate: spreadsheetBatchUpdate,
          values: { get, batchUpdate, update, append },
        },
      }),
    };
    process.env.GOOGLE_SHEET_ID = 'sheet-1';
    process.env.GOOGLE_WORKSHEET_NAME = 'Leads';
    const service = new SheetsService(auth as never);
    return { service, get, batchUpdate, update, append, spreadsheetBatchUpdate };
  }

  it('đọc header + rows với rowIndex bắt đầu từ 2', async () => {
    const { service } = setup([
      ['Tên khách hàng', 'Email'],
      ['A', 'a@x.com'],
    ]);
    const snap = await service.readSheet();
    expect(snap.headers).toEqual(['Tên khách hàng', 'Email']);
    expect(snap.rows[0]).toEqual({
      rowIndex: 2,
      values: { 'Tên khách hàng': 'A', Email: 'a@x.com' },
    });
    expect(service.detectFormat(snap)).toEqual({
      hasHeader: true,
      columnCount: 2,
      rowCount: 1,
      columnTypes: [
        { name: 'Tên khách hàng', inferred: 'string' },
        { name: 'Email', inferred: 'email' },
      ],
    });
  });

  it('ensureSystemColumns thêm header thiếu', async () => {
    const { service, update, get } = setup([['Tên khách hàng'], ['A']]);
    get.mockResolvedValueOnce({ data: { values: [['Tên khách hàng'], ['A']] } }).mockResolvedValueOnce({
      data: { values: [['Tên khách hàng', 'Lead ID Bitrix24'], ['A', '']] },
    });
    const snap = await service.ensureSystemColumns(['Lead ID Bitrix24']);
    expect(update).toHaveBeenCalled();
    expect(snap.headers).toContain('Lead ID Bitrix24');
  });

  it('batchUpdateCells tạo range A1 đúng cột', async () => {
    const { service, batchUpdate } = setup([['A', 'B']]);
    await service.batchUpdateCells(
      [
        { rowIndex: 2, column: 'B', value: 'x' },
        { rowIndex: 3, column: 'missing', value: 'skip' },
      ],
      ['A', 'B'],
    );
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          data: [expect.objectContaining({ range: "'Leads'!B2", values: [['x']] })],
        }),
      }),
    );
  });

  it('ẩn cột hệ thống và append hàng mới', async () => {
    const { service, spreadsheetBatchUpdate, append } = setup([
      ['Tên', 'Lead ID Bitrix24'],
      ['A', '1'],
    ]);
    await service.ensureSystemColumns(['Lead ID Bitrix24'], ['Lead ID Bitrix24']);
    expect(spreadsheetBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          requests: [
            expect.objectContaining({
              updateDimensionProperties: expect.objectContaining({
                properties: { hiddenByUser: true },
              }),
            }),
          ],
        }),
      }),
    );
    await service.appendRows([{ Tên: 'B' }], ['Tên', 'Lead ID Bitrix24'], 3);
    expect(append).toHaveBeenCalled();
  });
});
