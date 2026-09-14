import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MappingService } from '../src/sync/mapping.service';
import { ValidationService } from '../src/sync/validation.service';

function validation(): ValidationService {
  const file = join(mkdtempSync(join(tmpdir(), 'val-')), 'mapping.json');
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      dedupeFields: ['email'],
      systemColumns: {
        leadId: 'Lead ID Bitrix24',
        syncStatus: 'Trạng thái đồng bộ',
        lastSyncAt: 'Thời gian đồng bộ cuối',
        errorMessage: 'Thông báo lỗi',
        syncHash: 'Sync Hash',
      },
      columns: [
        { sheet: 'Tên khách hàng', bitrix: 'TITLE', type: 'string', required: true },
        { sheet: 'Email', bitrix: 'EMAIL', type: 'email', required: true },
      ],
    }),
  );
  process.env.MAPPING_FILE = file;
  return new ValidationService(new MappingService());
}

describe('ValidationService', () => {
  it('bắt thiếu field bắt buộc và email sai', () => {
    const service = validation();
    const issues = service.validateRow({
      rowIndex: 2,
      values: { 'Tên khách hàng': '', Email: 'abc' },
    });
    expect(issues.some((item) => item.field === 'Tên khách hàng')).toBe(true);
    expect(issues.some((item) => item.field === 'Email')).toBe(true);
  });

  it('hàng hợp lệ không có issue', () => {
    const service = validation();
    const issues = service.validateRow({
      rowIndex: 2,
      values: { 'Tên khách hàng': 'A', Email: 'a@x.com' },
    });
    expect(issues).toEqual([]);
  });

  it('assertNormalized thiếu title', () => {
    const service = validation();
    expect(
      service.assertNormalized({
        rowIndex: 2,
        title: '',
        fields: {},
        hash: 'x',
      }),
    ).toHaveLength(1);
  });
});
