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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiProperty,
  ApiSecurity,
} from '@nestjs/swagger';
import { NombaSignatureGuard } from './nomba-signature.guard';
import { WebhooksService } from './webhooks.service';

// ── Swagger shape classes ─────────────────────────────────────────────────────

class NombaMerchantDoc {
  @ApiProperty({ example: 'usr_nomba_abc123' }) userId: string;
  @ApiProperty({ example: 'wlt_nomba_xyz789' }) walletId: string;
  @ApiProperty({ example: 50000.00, description: 'Current merchant wallet balance in Naira' }) walletBalance: number;
}

class NombaTransactionDoc {
  @ApiProperty({ example: 'txn_nomba_a1b2c3' }) transactionId: string;
  @ApiProperty({ example: 'vact_transfer', description: 'Transfer type — vact_transfer means a virtual account credit' }) type: string;
  @ApiProperty({ example: 5000.00, description: 'Amount in Naira (multiply by 100 for kobo)' }) transactionAmount: number;
  @ApiProperty({ example: 0.00 }) fee: number;
  @ApiProperty({ example: '2024-01-15T14:30:00Z' }) time: string;
  @ApiProperty({ example: '00' }) responseCode: string;
  @ApiProperty({ example: '0010234567', description: 'Virtual account number that received funds' }) aliasAccountNumber: string;
}

class NombaCustomerDoc {
  @ApiProperty({ example: 'Chukwuemeka Obi', description: 'Name of the person who sent the money' }) senderName: string;
  @ApiProperty({ example: 'Ajo Wallet' }) recipientName: string;
}

class NombaWebhookPayloadDoc {
  @ApiProperty({
    example: 'payment_success',
    enum: ['payment_success', 'payout_success', 'payment_failed', 'payout_failed', 'payment_reversal', 'payout_refund'],
    description: 'Type of event Nomba is reporting',
  })
  event_type: string;

  @ApiProperty({ example: 'req_abc123xyz', description: 'Unique ID for this webhook delivery (used for idempotency)' })
  requestId: string;

  @ApiProperty({ type: () => ({ merchant: NombaMerchantDoc, transaction: NombaTransactionDoc, customer: NombaCustomerDoc }) })
  data: {
    merchant: NombaMerchantDoc;
    transaction: NombaTransactionDoc;
    customer: NombaCustomerDoc;
  };
}

class WebhookReceivedShape {
  @ApiProperty({ example: true }) received: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('nomba')
  @UseGuards(NombaSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Nomba payment event callback',
    description:
      '**This endpoint is called by Nomba, not by your frontend.**\n\n' +
      'Register `https://ajo-server.onrender.com/api/v1/webhooks/nomba` in the ' +
      'Nomba dashboard under **Settings → Webhook & API Keys**.\n\n' +
      '**Signature verification:** Every request must include the `nomba-signature` ' +
      'header containing an HMAC-SHA256 digest of key payload fields signed with ' +
      'the `NOMBA_WEBHOOK_SIGNATURE_KEY` env var. Requests failing verification are ' +
      'rejected with 401.\n\n' +
      '**Supported event types:**\n' +
      '- `payment_success` — money received into a virtual account → credits user wallet\n' +
      '- `payout_success` — bank payout confirmed → marks withdrawal as successful\n' +
      '- `payment_failed` / `payout_failed` — marks ledger entry as failed\n' +
      '- `payment_reversal` / `payout_refund` — reverses the original ledger entry\n\n' +
      '**Idempotency:** duplicate deliveries (Nomba retries on 5xx) are silently ' +
      'ignored using `transactionId` as the idempotency key.\n\n' +
      'Always returns 200 — even for events we don\'t handle — to stop Nomba\'s retry loop.',
  })
  @ApiSecurity('nomba-signature', ['nomba-signature', 'nomba-timestamp'])
  @ApiBody({ type: NombaWebhookPayloadDoc })
  @ApiOkResponse({ type: WebhookReceivedShape })
  @ApiUnauthorizedResponse({ description: 'HMAC signature missing or invalid.' })
  async handleNombaWebhook(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Body() payload: any,
  ): Promise<{ received: boolean }> {
    this.webhooksService.handleEvent(payload as Parameters<typeof this.webhooksService.handleEvent>[0]).catch((err: Error) => {
      this.logger.error(
        `Unhandled error processing Nomba event ${String(payload?.event_type)} ` +
          `requestId=${String(payload?.requestId)}: ${err.message}`,
        err.stack,
      );
    });

    return { received: true };
  }
}
