import { Injectable } from '@nestjs/common';
import { ConflictStrategy } from '../core/types';

export type ConflictWinner = 'sheet' | 'bitrix' | 'none';

export interface ConflictInput {
  strategy: ConflictStrategy;
  sheetChanged: boolean;
  bitrixChanged: boolean;
  sheetUpdatedAt?: string;
  bitrixUpdatedAt?: string;
}

@Injectable()
export class ConflictService {
  /**
   * Quyết định phía nào thắng khi cùng một lead bị sửa ở cả Sheet và Bitrix.
   */
  resolve(input: ConflictInput): ConflictWinner {
    if (!input.sheetChanged && !input.bitrixChanged) {
      return 'none';
    }
    if (input.sheetChanged && !input.bitrixChanged) {
      return 'sheet';
    }
    if (!input.sheetChanged && input.bitrixChanged) {
      return 'bitrix';
    }

    switch (input.strategy) {
      case 'sheet_wins':
        return 'sheet';
      case 'bitrix_wins':
        return 'bitrix';
      case 'last_write_wins':
      default:
        return this.newerSide(input.sheetUpdatedAt, input.bitrixUpdatedAt);
    }
  }

  private newerSide(sheetAt?: string, bitrixAt?: string): ConflictWinner {
    const sheetTime = sheetAt ? Date.parse(sheetAt) : Number.NaN;
    const bitrixTime = bitrixAt ? Date.parse(bitrixAt) : Number.NaN;
    if (Number.isNaN(sheetTime) && Number.isNaN(bitrixTime)) {
      return 'bitrix';
    }
    if (Number.isNaN(sheetTime)) {
      return 'bitrix';
    }
    if (Number.isNaN(bitrixTime)) {
      return 'sheet';
    }
    return bitrixTime >= sheetTime ? 'bitrix' : 'sheet';
  }
}
