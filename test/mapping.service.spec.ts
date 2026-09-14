import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MappingService } from '../src/sync/mapping.service';
import { MappingConfig } from '../src/core/types';

const sample: MappingConfig = {
  version: 1,
  dedupeFields: ['email', 'phone'],
  conflictStrategy: 'last_write_wins',
  systemColumns: {
    leadId: 'Lead ID Bitrix24',
    syncStatus: 'Trạng thái đồng bộ',
    lastSyncAt: 'Thời gian đồng bộ cuối',
    errorMessage: 'Thông báo lỗi',
    syncHash: 'Sync Hash',
  },
  columns: [
    { sheet: 'Tên khách hàng', bitrix: 'TITLE', type: 'string', required: true, trim: true },
    { sheet: 'Email', bitrix: 'EMAIL', type: 'email', required: true, multivalue: true },
    { sheet: 'Số điện thoại', bitrix: 'PHONE', type: 'phone', required: false, multivalue: true },
    { sheet: 'Ngân sách dự kiến', bitrix: 'OPPORTUNITY', type: 'number' },
    {
      sheet: 'Trạng thái',
      bitrix: 'STATUS_ID',
      type: 'enum',
      enumMap: { mới: 'NEW', 'đang xử lý': 'IN_PROCESS' },
    },
    {
      sheet: 'Nguồn lead (UTM Source)',
      bitrix: 'UTM_SOURCE',
      type: 'enum',
      alsoWrite: 'SOURCE_ID',
      enumMap: { website: 'WEB' },
    },
  ],
  customFields: [{ sheet: 'Ngành nghề', bitrix: 'UF_CRM_INDUSTRY', type: 'string' }],
  twoWayFields: ['TITLE', 'STATUS_ID'],
};

function serviceWithConfig(config: MappingConfig = sample): MappingService {
  const dir = mkdtempSync(join(tmpdir(), 'map-'));
  const file = join(dir, 'mapping.json');
  writeFileSync(file, JSON.stringify(config));
  process.env.MAPPING_FILE = file;
  return new MappingService();
}

describe('MappingService', () => {
  it('normalize row: email/phone/enum/custom + hash', () => {
    const mapping = serviceWithConfig();
    const lead = mapping.normalizeRow({
      rowIndex: 2,
      values: {
        'Tên khách hàng': '  Nguyen Van A ',
        Email: 'A@Mail.com',
        'Số điện thoại': '0901234567',
        'Ngân sách dự kiến': '50.000.000',
        'Trạng thái': 'Mới',
        'Nguồn lead (UTM Source)': 'website',
        'Ngành nghề': 'Phần mềm',
        'Lead ID Bitrix24': '',
        'Sync Hash': '',
      },
    });

    expect(lead.title).toBe('Nguyen Van A');
    expect(lead.email).toBe('a@mail.com');
    expect(lead.phone).toBe('+84901234567');
    expect(lead.fields.STATUS_ID).toBe('NEW');
    expect(lead.fields.SOURCE_ID).toBe('WEB');
    expect(lead.fields.UF_CRM_INDUSTRY).toBe('Phần mềm');
    expect(lead.fields.OPPORTUNITY).toBe(50000000);
    expect(lead.hash).toHaveLength(64);
  });

  it('ném lỗi email không hợp lệ', () => {
    const mapping = serviceWithConfig();
    expect(() => mapping.transformValue('bad', sample.columns[1])).toThrow(/Email/);
  });

  it('leadToSheetValues chỉ lấy twoWayFields', () => {
    const mapping = serviceWithConfig();
    const values = mapping.leadToSheetValues({
      TITLE: 'X',
      STATUS_ID: 'NEW',
      COMMENTS: 'hidden',
    });
    expect(values['Tên khách hàng']).toBe('X');
    expect(values['Trạng thái']).toBe('mới');
    expect(values['Ghi chú']).toBeUndefined();
  });

  it('leadToSheetValues allFields lấy cả cột ngoài twoWayFields', () => {
    const mapping = serviceWithConfig();
    const values = mapping.leadToSheetValues(
      { TITLE: 'X', EMAIL: [{ VALUE: 'a@x.com' }] },
      mapping.load(),
      { allFields: true },
    );
    expect(values.Email).toBe('a@x.com');
  });

  it('save + reload', () => {
    const mapping = serviceWithConfig();
    const next = mapping.save({ ...sample, version: 2 });
    expect(next.version).toBe(2);
    expect(mapping.reload().version).toBe(2);
  });
});
