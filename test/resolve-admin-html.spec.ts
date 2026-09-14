import { existsSync } from 'fs';
import { resolveAdminHtml } from '../src/admin/resolve-admin-html';

describe('resolveAdminHtml', () => {
  it('tìm được file admin từ thư mục source', () => {
    const file = resolveAdminHtml();
    expect(existsSync(file)).toBe(true);
    expect(file.replace(/\\/g, '/')).toMatch(/admin\/public\/index\.html$/);
  });
});
