import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { NombaSignatureGuard } from './nomba-signature.guard';

@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService, NombaSignatureGuard],
})
export class WebhooksModule {}
