import {
  foldVietnamese,
  normalizeDate,
  normalizeEmail,
  normalizeEnum,
  normalizeNumber,
  normalizePhone,
  splitMultiValue,
} from '../src/core/normalize.util';

describe('normalizeEmail', () => {
  it('trim + lowercase', () => {
    expect(normalizeEmail('  A@Mail.COM ')).toBe('a@mail.com');
  });

  it('trả undefined khi không hợp lệ', () => {
    expect(normalizeEmail('not-an-email')).toBeUndefined();
    expect(normalizeEmail('')).toBeUndefined();
  });
});

describe('normalizePhone', () => {
  it('chuẩn hóa số VN 0xxx thành +84', () => {
    expect(normalizePhone('0901234567')).toBe('+84901234567');
    expect(normalizePhone('84 901 234 567')).toBe('+84901234567');
    expect(normalizePhone('+84 90 123 4567')).toBe('+84901234567');
  });

  it('bỏ số quá ngắn', () => {
    expect(normalizePhone('123')).toBeUndefined();
    expect(normalizePhone('')).toBeUndefined();
  });
});

describe('normalizeNumber / date / enum', () => {
  it('parse số có dấu phân cách VN', () => {
    expect(normalizeNumber('50.000.000')).toBe(50000000);
    expect(normalizeNumber('abc')).toBeUndefined();
  });

  it('parse ngày dd/MM/yyyy', () => {
    const iso = normalizeDate('13/09/2026');
    expect(iso).toContain('2026-09-13');
  });

  it('map enum không dấu / có dấu', () => {
    const map = { mới: 'NEW', 'dang xu ly': 'IN_PROCESS' };
    expect(normalizeEnum('Mới', map)).toBe('NEW');
    expect(normalizeEnum('Đang xử lý', map)).toBe('IN_PROCESS');
    expect(normalizeEnum('UNKNOWN', map)).toBe('UNKNOWN');
  });

  it('fold tiếng Việt', () => {
    expect(foldVietnamese('Đối tác')).toBe('doi tac');
  });

  it('tách multi-value', () => {
    expect(splitMultiValue('a@x.com; b@y.com | c@z.com')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ]);
  });
});
