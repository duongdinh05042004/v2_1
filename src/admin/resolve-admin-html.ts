import { existsSync } from 'fs';
import { join } from 'path';

/** Tìm index.html ở src (dev) hoặc dist (prod) — không phụ thuộc nest copy assets. */
export function resolveAdminHtml(): string {
  const candidates = [
    join(process.cwd(), 'src', 'admin', 'public', 'index.html'),
    join(__dirname, 'public', 'index.html'),
    join(process.cwd(), 'dist', 'admin', 'public', 'index.html'),
  ];
  const found = candidates.find((file) => existsSync(file));
  if (!found) {
    throw new Error(
      `Không tìm thấy admin UI. Đã thử:\n${candidates.map((item) => `- ${item}`).join('\n')}`,
    );
  }
  return found;
}
