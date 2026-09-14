import { computeSyncHash } from '../src/core/hash.util';

describe('computeSyncHash', () => {
  it('cùng dữ liệu theo thứ tự key khác nhau cho ra hash giống nhau', () => {
    const a = computeSyncHash({ TITLE: 'A', EMAIL: 'a@x.com' });
    const b = computeSyncHash({ EMAIL: 'a@x.com', TITLE: 'A' });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('thay đổi field sẽ đổi hash', () => {
    const a = computeSyncHash({ TITLE: 'A' });
    const b = computeSyncHash({ TITLE: 'B' });
    expect(a).not.toBe(b);
  });

  it('bỏ qua undefined và xử lý nested/array', () => {
    const a = computeSyncHash({ TITLE: 'A', skip: undefined, tags: ['x', 'y'], nested: { z: 1 } });
    const b = computeSyncHash({ nested: { z: 1 }, TITLE: 'A', tags: ['x', 'y'] });
    expect(a).toBe(b);
  });
});
