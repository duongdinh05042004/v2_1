import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { computeSyncHash } from '../core/hash.util';
import { RecordLog, SyncCounters } from '../core/types';

interface LocalLead {
  id: string;
  email?: string;
  phone?: string;
  hash: string;
  title: string;
}

const CRM_FILE = join(process.cwd(), 'data', 'local-crm.json');
const SAMPLE = join(process.cwd(), 'samples', 'leads-template.csv');

export function runLocalFallback(counters: SyncCounters, records: RecordLog[]): void {
  const rows = readSampleRows();
  const store = readCrm();
  let nextId = store.nextId;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowIndex = i + 2;
    const email = (row.Email || '').trim().toLowerCase();
    const phone = (row['Số điện thoại'] || '').trim();
    const title = (row['Tên khách hàng'] || '').trim();
    if (!title || !email) {
      counters.errors += 1;
      records.push({
        rowIndex,
        action: 'error',
        message: 'Validation failed',
        error: 'Thiếu tên hoặc email',
      });
      continue;
    }

    const hash = computeSyncHash({ title, email, phone });
    const existing =
      store.leads.find((item) => item.email === email || (phone && item.phone === phone));

    if (existing && existing.hash === hash) {
      counters.skipped += 1;
      records.push({
        rowIndex,
        action: 'skipped',
        leadId: existing.id,
        message: 'Không có thay đổi (sync hash trùng)',
      });
      continue;
    }

    if (existing) {
      existing.hash = hash;
      existing.title = title;
      existing.phone = phone || existing.phone;
      counters.updated += 1;
      records.push({
        rowIndex,
        action: 'updated',
        leadId: existing.id,
        message: `Cập nhật lead ${existing.id}`,
      });
      continue;
    }

    const id = String(nextId);
    nextId += 1;
    store.leads.push({ id, email, phone, hash, title });
    counters.created += 1;
    records.push({
      rowIndex,
      action: 'created',
      leadId: id,
      message: `Tạo lead mới ${id}`,
    });
  }

  store.nextId = nextId;
  writeCrm(store);
}

function readSampleRows(): Array<Record<string, string>> {
  if (!existsSync(SAMPLE)) {
    return [];
  }
  const lines = readFileSync(SAMPLE, 'utf8').trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] ?? '';
    });
    return row;
  });
}

function readCrm(): { nextId: number; leads: LocalLead[] } {
  if (!existsSync(CRM_FILE)) {
    return { nextId: 1001, leads: [] };
  }
  try {
    return JSON.parse(readFileSync(CRM_FILE, 'utf8')) as { nextId: number; leads: LocalLead[] };
  } catch {
    return { nextId: 1001, leads: [] };
  }
}

function writeCrm(store: { nextId: number; leads: LocalLead[] }): void {
  mkdirSync(dirname(CRM_FILE), { recursive: true });
  writeFileSync(CRM_FILE, JSON.stringify(store, null, 2), 'utf8');
}
