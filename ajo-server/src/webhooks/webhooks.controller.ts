/**
 * WebhooksController
 *
 * Exposes POST /api/v1/webhooks/nomba — register this URL in the Nomba dashboard
 * under Settings → Webhook & API Keys.
 *
 * Flow:
 *   1. NombaSignatureGuard verifies HMAC-SHA256 signature (rejects forgeries).
 *   2. WebhooksService dispatches the event to the correct handler.
 *   3. Always respond 200 immediately — stops Nomba's retry loop.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { NombaSignatureGuard } from './nomba-signature.guard';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) { }

  /**
   * POST /api/v1/webhooks/nomba
   *
   * NOTE: @Body() is typed as `any` intentionally here.
   * The global ValidationPipe with forbidNonWhitelisted would reject Nomba's
   * payload since it isn't a decorated DTO class. The NombaSignatureGuard
   * validates structure and authenticity before the service touches the data.
   */
  @Post('nomba')
  @UseGuards(NombaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  async handleNombaWebhook(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Body() payload: any,
  ): Promise<{ received: boolean }> {
    // Fire-and-forget — return 200 immediately so Nomba doesn't retry.
    // Errors are caught and logged inside the service.
    this.webhooksService
      .handleEvent(
        payload as Parameters<typeof this.webhooksService.handleEvent>[0],
      )
      .catch((err: Error) => {
        this.logger.error(
          `Unhandled error processing Nomba event ${String(payload?.event_type)} ` +
            `requestId=${String(payload?.requestId)}: ${err.message}`,
          err.stack,
        );
      });

    return { received: true };
  }
}
