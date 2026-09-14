import { columnIndexToLetter } from '../src/core/column.util';

describe('columnIndexToLetter', () => {
  it('đổi index sang A1', () => {
    expect(columnIndexToLetter(0)).toBe('A');
    expect(columnIndexToLetter(25)).toBe('Z');
    expect(columnIndexToLetter(26)).toBe('AA');
    expect(columnIndexToLetter(27)).toBe('AB');
  });
});
