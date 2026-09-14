import { Module } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { SheetsService } from './sheets.service';

@Module({
  providers: [GoogleAuthService, SheetsService],
  exports: [GoogleAuthService, SheetsService],
})
export class GoogleModule {}
