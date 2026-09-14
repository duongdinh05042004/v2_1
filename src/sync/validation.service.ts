import { Injectable } from '@nestjs/common';
import { normalizeEmail } from '../core/normalize.util';
import { MappingService } from './mapping.service';
import { NormalizedLead, SheetRow } from '../core/types';

export interface ValidationIssue {
  field: string;
  message: string;
}

@Injectable()
export class ValidationService {
  constructor(private readonly mapping: MappingService) {}

  validateRow(row: SheetRow): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const config = this.mapping.load();

    for (const field of this.mapping.allMappings(config)) {
      const raw = (row.values[field.sheet] ?? '').trim();
      if (field.required && !raw) {
        issues.push({ field: field.sheet, message: `Thiếu trường bắt buộc: ${field.sheet}` });
        continue;
      }
      if (!raw) {
        continue;
      }
      try {
        this.mapping.transformValue(raw, field);
      } catch (error) {
        issues.push({
          field: field.sheet,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const emailCol = config.columns.find((col) => col.bitrix === 'EMAIL');
    if (emailCol) {
      const email = row.values[emailCol.sheet];
      if (email && !normalizeEmail(email)) {
        issues.push({ field: emailCol.sheet, message: 'Email không đúng định dạng' });
      }
    }

    return issues;
  }

  assertNormalized(lead: NormalizedLead): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!lead.title) {
      issues.push({ field: 'TITLE', message: 'Thiếu tên khách hàng / TITLE' });
    }
    return issues;
  }
}
