import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { SyncModule } from '../sync/sync.module';
import { WebhookController } from '../webhook/webhook.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [SyncModule, GoogleModule],
  controllers: [AdminController, WebhookController],
})
export class AdminModule {}
