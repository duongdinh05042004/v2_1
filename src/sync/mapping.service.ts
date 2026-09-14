import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { loadAppConfig } from '../core/configuration';
import { computeSyncHash } from '../core/hash.util';
import {
  normalizeDate,
  normalizeEmail,
  normalizeEnum,
  normalizeNumber,
  normalizePhone,
  splitMultiValue,
} from '../core/normalize.util';
import { FieldMapping, MappingConfig, NormalizedLead, SheetRow } from '../core/types';

@Injectable()
export class MappingService {
  private cached?: MappingConfig;
  private readonly mappingFile: string;

  constructor() {
    this.mappingFile = loadAppConfig().mappingFile;
  }

  load(): MappingConfig {
    if (this.cached) {
      return this.cached;
    }
    if (!existsSync(this.mappingFile)) {
      throw new Error(`Không tìm thấy file mapping: ${this.mappingFile}`);
    }
    this.cached = JSON.parse(readFileSync(this.mappingFile, 'utf8')) as MappingConfig;
    return this.cached;
  }

  reload(): MappingConfig {
    this.cached = undefined;
    return this.load();
  }

  save(config: MappingConfig): MappingConfig {
    mkdirSync(dirname(this.mappingFile), { recursive: true });
    writeFileSync(this.mappingFile, JSON.stringify(config, null, 2), 'utf8');
    this.cached = config;
    return config;
  }

  allMappings(config = this.load()): FieldMapping[] {
    return [...config.columns, ...(config.customFields ?? [])];
  }

  systemHeaders(config = this.load()): string[] {
    return Object.values(config.systemColumns).filter(Boolean) as string[];
  }

  /**
   * Chuyển một hàng Sheet thành payload Bitrix đã chuẩn hóa + sync hash.
   */
  normalizeRow(row: SheetRow, config = this.load()): NormalizedLead {
    const fields: Record<string, unknown> = {};
    let email: string | undefined;
    let phone: string | undefined;
    let title = '';

    for (const mapping of this.allMappings(config)) {
      const raw = row.values[mapping.sheet] ?? '';
      const value = this.transformValue(raw, mapping);
      if (value === undefined || value === '') {
        continue;
      }
      fields[mapping.bitrix] = value;
      if (mapping.alsoWrite) {
        fields[mapping.alsoWrite] = value;
      }
      if (mapping.bitrix === 'TITLE') {
        title = String(value);
      }
      if (mapping.bitrix === 'EMAIL') {
        email = Array.isArray(value)
          ? String((value[0] as { VALUE?: string })?.VALUE ?? '')
          : String(value);
      }
      if (mapping.bitrix === 'PHONE') {
        phone = Array.isArray(value)
          ? String((value[0] as { VALUE?: string })?.VALUE ?? '')
          : String(value);
      }
    }

    const hashSource = { ...fields };
    return {
      rowIndex: row.rowIndex,
      title,
      fields,
      email: normalizeEmail(email) ?? email,
      phone: normalizePhone(phone) ?? phone,
      hash: computeSyncHash(hashSource),
      existingLeadId: row.values[config.systemColumns.leadId]?.trim() || undefined,
      previousHash: row.values[config.systemColumns.syncHash]?.trim() || undefined,
      sheetUpdatedAt: row.values[config.systemColumns.sheetUpdatedAt ?? '']?.trim() || undefined,
    };
  }

  transformValue(raw: string, mapping: FieldMapping): unknown {
    const source = mapping.trim === false ? raw : raw.trim();
    if (!source) {
      return undefined;
    }

    switch (mapping.type) {
      case 'email': {
        const parts = mapping.multivalue ? splitMultiValue(source) : [source];
        const emails = parts
          .map((part) => normalizeEmail(part))
          .filter((part): part is string => Boolean(part));
        if (!emails.length) {
          throw new Error(`Email không hợp lệ: "${source}"`);
        }
        return emails.map((VALUE) => ({ VALUE, VALUE_TYPE: 'WORK' }));
      }
      case 'phone': {
        const parts = mapping.multivalue ? splitMultiValue(source) : [source];
        const phones = parts
          .map((part) => normalizePhone(part))
          .filter((part): part is string => Boolean(part));
        if (!phones.length) {
          throw new Error(`Số điện thoại không hợp lệ: "${source}"`);
        }
        return phones.map((VALUE) => ({ VALUE, VALUE_TYPE: 'WORK' }));
      }
      case 'number': {
        const parsed = normalizeNumber(source);
        if (parsed === undefined) {
          throw new Error(`Số không hợp lệ: "${source}"`);
        }
        return parsed;
      }
      case 'date':
        return normalizeDate(source) ?? source;
      case 'enum':
        return normalizeEnum(source, mapping.enumMap);
      default:
        return source;
    }
  }

  /**
   * Map lead Bitrix về các cột Sheet (chiều ngược).
   */
  leadToSheetValues(
    lead: Record<string, unknown>,
    config = this.load(),
    options: { allFields?: boolean } = {},
  ): Record<string, string> {
    const values: Record<string, string> = {};
    for (const mapping of this.allMappings(config)) {
      if (
        !options.allFields &&
        config.twoWayFields &&
        !config.twoWayFields.includes(mapping.bitrix)
      ) {
        continue;
      }
      values[mapping.sheet] = this.stringifyBitrixValue(lead[mapping.bitrix], mapping);
    }
    return values;
  }

  stringifyBitrixValue(value: unknown, mapping: FieldMapping): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item && typeof item === 'object' && 'VALUE' in item) {
            return String((item as { VALUE: unknown }).VALUE);
          }
          return String(item);
        })
        .join(', ');
    }
    if (mapping.type === 'enum' && mapping.enumMap) {
      const reverse = Object.entries(mapping.enumMap).find(([, to]) => to === String(value));
      if (reverse) {
        return reverse[0];
      }
    }
    return String(value);
  }
}
