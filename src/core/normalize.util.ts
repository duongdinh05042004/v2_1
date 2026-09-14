import { parse, isValid, formatISO } from 'date-fns';

const DATE_FORMATS = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'yyyy/MM/dd'];

export function normalizeEmail(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return undefined;
  }
  return email;
}

/**
 * Chuẩn hóa SĐT Việt Nam về dạng E.164 (+84...).
 * Giữ nguyên số quốc tế khác nếu đã có dấu +.
 */
export function normalizePhone(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) {
    return undefined;
  }

  if (hasPlus) {
    return `+${digits}`;
  }

  if (digits.startsWith('84') && digits.length >= 11) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length >= 10) {
    return `+84${digits.slice(1)}`;
  }

  return `+${digits}`;
}

export function normalizeNumber(raw?: string): number | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeDate(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const isoTry = new Date(raw);
  if (!Number.isNaN(isoTry.getTime()) && raw.includes('-') && raw.length >= 10) {
    return formatISO(isoTry);
  }
  for (const pattern of DATE_FORMATS) {
    const parsed = parse(raw.trim(), pattern, new Date());
    if (isValid(parsed)) {
      return formatISO(parsed);
    }
  }
  return undefined;
}

export function normalizeEnum(
  raw: string | undefined,
  enumMap?: Record<string, string>,
): string | undefined {
  if (!raw) {
    return undefined;
  }
  const key = foldVietnamese(raw.trim());
  if (!enumMap) {
    return raw.trim();
  }
  const direct = enumMap[raw.trim()] ?? enumMap[key] ?? enumMap[raw.trim().toLowerCase()];
  if (direct) {
    return direct;
  }
  for (const [from, to] of Object.entries(enumMap)) {
    if (foldVietnamese(from) === key) {
      return to;
    }
  }
  return raw.trim();
}

export function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

export function splitMultiValue(raw?: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[;,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
