import { createHash } from 'crypto';

/**
 * Tạo fingerprint ổn định cho payload lead.
 * Dùng để phát hiện thay đổi và đảm bảo idempotency khi chạy lại job.
 */
export function computeSyncHash(payload: Record<string, unknown>): string {
  const normalized = stableStringify(payload);
  return createHash('sha256').update(normalized).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
