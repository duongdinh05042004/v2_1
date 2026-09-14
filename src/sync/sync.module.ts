import { Module } from '@nestjs/common';
import { Bitrix24Module } from '../bitrix24/bitrix24.module';
import { GoogleModule } from '../google/google.module';
import { ConflictService } from './conflict.service';
import { MappingService } from './mapping.service';
import { SyncLoggerService } from './sync-logger.service';
import { SyncScheduler } from './sync.scheduler';
import { SyncService } from './sync.service';
import { ValidationService } from './validation.service';

@Module({
  imports: [GoogleModule, Bitrix24Module],
  providers: [
    MappingService,
    ValidationService,
    ConflictService,
    SyncLoggerService,
    SyncService,
    SyncScheduler,
  ],
  exports: [MappingService, ValidationService, ConflictService, SyncLoggerService, SyncService],
})
export class SyncModule {}
