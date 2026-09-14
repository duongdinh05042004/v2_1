import { Module } from '@nestjs/common';
import { Bitrix24Service } from './bitrix24.service';

@Module({
  providers: [Bitrix24Service],
  exports: [Bitrix24Service],
})
export class Bitrix24Module {}
