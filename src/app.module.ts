import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { Bitrix24Module } from './bitrix24/bitrix24.module';
import { GoogleModule } from './google/google.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    GoogleModule,
    Bitrix24Module,
    SyncModule,
    AdminModule,
  ],
})
export class AppModule {}
