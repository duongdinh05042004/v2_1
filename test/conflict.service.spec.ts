import { ConflictService } from '../src/sync/conflict.service';

describe('ConflictService', () => {
  const service = new ConflictService();

  it('không conflict khi không bên nào đổi', () => {
    expect(
      service.resolve({
        strategy: 'last_write_wins',
        sheetChanged: false,
        bitrixChanged: false,
      }),
    ).toBe('none');
  });

  it('chỉ một bên đổi thì bên đó thắng', () => {
    expect(
      service.resolve({
        strategy: 'last_write_wins',
        sheetChanged: true,
        bitrixChanged: false,
      }),
    ).toBe('sheet');
    expect(
      service.resolve({
        strategy: 'last_write_wins',
        sheetChanged: false,
        bitrixChanged: true,
      }),
    ).toBe('bitrix');
  });

  it('priority-based', () => {
    const both = { sheetChanged: true, bitrixChanged: true };
    expect(service.resolve({ ...both, strategy: 'sheet_wins' })).toBe('sheet');
    expect(service.resolve({ ...both, strategy: 'bitrix_wins' })).toBe('bitrix');
  });

  it('last-write-wins theo timestamp', () => {
    expect(
      service.resolve({
        strategy: 'last_write_wins',
        sheetChanged: true,
        bitrixChanged: true,
        sheetUpdatedAt: '2026-09-13T08:00:00.000Z',
        bitrixUpdatedAt: '2026-09-13T09:00:00.000Z',
      }),
    ).toBe('bitrix');
    expect(
      service.resolve({
        strategy: 'last_write_wins',
        sheetChanged: true,
        bitrixChanged: true,
        sheetUpdatedAt: '2026-09-13T10:00:00.000Z',
        bitrixUpdatedAt: '2026-09-13T09:00:00.000Z',
      }),
    ).toBe('sheet');
  });
});
