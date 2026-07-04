import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { NombaWebhookPayload } from './nomba-webhook.types';
// Prisma enums — use string literals to avoid pre-generate import issues
// Once prisma generate runs, these enums are available from '@prisma/client'

const toKobo = (naira: number): number => Math.round(naira * 100);

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async handleEvent(payload: NombaWebhookPayload): Promise<void> {
    const { event_type, requestId, data } = payload;
    this.logger.log(`Nomba webhook: event=${event_type} requestId=${requestId}`);

    switch (event_type) {
      case 'payment_success':  await this.handlePaymentSuccess(payload); break;
      case 'payout_success':   await this.handlePayoutSuccess(payload);  break;
      case 'payment_failed':
      case 'payout_failed':    await this.handleFailed(payload);         break;
      case 'payment_reversal':
      case 'payout_refund':    await this.handleReversal(payload);       break;
      default:
        this.logger.warn(`Unhandled Nomba event: ${event_type as string}`);
    }
  }

  private async handlePaymentSuccess(payload: NombaWebhookPayload): Promise<void> {
    const { requestId, data } = payload;
    const { transaction, customer } = data;

    const nombaReference = transaction.transactionId;
    const amountKobo = toKobo(transaction.transactionAmount);

    // Idempotency
    const existing = await this.prisma.transaction.findFirst({ where: { nombaReference } });
    if (existing) {
      this.logger.log(`Duplicate webhook — skipping ${nombaReference}`);
      return;
    }

    // Our orderReference comes back in data.order.orderReference for
    // checkout order payments (NOT transaction.aliasAccountReference —
    // see nomba-webhook.types.ts for why).
    const orderReference = data.order?.orderReference;
    if (!orderReference) {
      this.logger.warn(`payment_success missing order.orderReference requestId=${requestId}`);
      return;
    }

    const pendingCheckout = await this.prisma.pendingCheckout.findUnique({
      where: { orderReference },
    });
    if (!pendingCheckout) {
      this.logger.warn(`No PendingCheckout for orderReference=${orderReference}`);
      return;
    }

    const journalId = `jrnl_dep_${nombaReference}`;

    await this.prisma.$transaction(async (tx) => {
      // CREDIT user wallet
      await tx.transaction.create({
        data: {
          walletId: pendingCheckout.walletId,
          direction: 'CREDIT',
          type: 'DEPOSIT',
          status: 'SUCCESSFUL',
          amountKobo,
          journalId,
          reference: `DEP-${nombaReference}`,
          description: `Wallet funded via Nomba checkout`,
          counterpartyName: customer?.senderName ?? 'Payment',
          nombaOrderReference: orderReference,
          nombaReference,
          nombaWebhookData: payload as object,
        },
      });

      // Update cached balance
      await tx.wallet.update({
        where: { id: pendingCheckout.walletId },
        data: { balanceKobo: { increment: amountKobo } },
      });

      // Consume PendingCheckout
      await tx.pendingCheckout.delete({ where: { orderReference } });

      this.logger.log(
        `Deposit credited: walletId=${pendingCheckout.walletId} ` +
        `amountKobo=${amountKobo} orderRef=${orderReference}`,
      );
    });

    const amountLabel = `₦${(amountKobo / 100).toLocaleString('en-NG')}`;

    // Dedicated event for the client to invalidate wallet/transactions
    // queries, plus a persisted notification-feed entry.
    this.realtime.emitToUser(pendingCheckout.userId, REALTIME_EVENTS.WALLET_FUNDED, {
      amountKobo,
      reference: `DEP-${nombaReference}`,
    });

    this.realtime
      .notify({
        userId: pendingCheckout.userId,
        type: 'WALLET_FUNDED',
        title: 'Wallet funded',
        body: `Your wallet was credited with ${amountLabel}`,
      })
      .catch((err) =>
        this.logger.warn(`Failed to save wallet-funded notification: ${err}`),
      );
  }

  private async handlePayoutSuccess(payload: NombaWebhookPayload): Promise<void> {
    const nombaReference = payload.data.transaction.transactionId;
    const txn = await this.prisma.transaction.findFirst({
      where: { nombaReference, type: 'WITHDRAWAL' },
    });
    if (!txn) { this.logger.warn(`payout_success: no withdrawal for ${nombaReference}`); return; }
    await this.prisma.transaction.update({
      where: { id: txn.id },
      data: { status: 'SUCCESSFUL', nombaWebhookData: payload as object },
    });
    this.logger.log(`Withdrawal confirmed: txnId=${txn.id}`);
  }

  private async handleFailed(payload: NombaWebhookPayload): Promise<void> {
    const nombaReference = payload.data.transaction.transactionId;
    const orderReference = payload.data.order?.orderReference;

    if (orderReference) {
      await this.prisma.pendingCheckout.delete({ where: { orderReference } }).catch(() => {});
    }

    const txn = await this.prisma.transaction.findFirst({ where: { nombaReference } });
    if (!txn) {
      this.logger.warn(`Transaction failed: ${payload.event_type} nombaRef=${nombaReference} (no matching txn)`);
      return;
    }

    if (txn.type === 'WITHDRAWAL' && txn.status === 'PENDING') {
      // Withdrawal was debited upfront when requested (see wallet.service.ts
      // withdraw()) — the bank payout failed, so that money never left and
      // must go back into the user's wallet.
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: txn.id },
          data: { status: 'FAILED', nombaWebhookData: payload as object },
        });
        await tx.wallet.update({
          where: { id: txn.walletId },
          data: { balanceKobo: { increment: txn.amountKobo } },
        });
      });
      this.logger.warn(`Payout failed, refunded walletId=${txn.walletId} amountKobo=${txn.amountKobo}`);
      return;
    }

    await this.prisma.transaction.update({
      where: { id: txn.id },
      data: { status: 'FAILED', nombaWebhookData: payload as object },
    });
    this.logger.warn(`Transaction failed: ${payload.event_type} nombaRef=${nombaReference}`);
  }

  private async handleReversal(payload: NombaWebhookPayload): Promise<void> {
    const nombaReference = payload.data.transaction.transactionId;
    const amountKobo = toKobo(payload.data.transaction.transactionAmount);

    const originalTxn = await this.prisma.transaction.findFirst({ where: { nombaReference } });
    if (!originalTxn) { this.logger.warn(`Reversal: no original tx for ${nombaReference}`); return; }

    const reversalDirection = originalTxn.direction === 'CREDIT'
      ? 'DEBIT' : 'CREDIT';

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          walletId: originalTxn.walletId,
          direction: reversalDirection,
          type: 'REVERSAL',
          status: 'SUCCESSFUL',
          amountKobo,
          journalId: `jrnl_rev_${nombaReference}`,
          reference: `REV-${nombaReference}`,
          description: `Reversal of ${nombaReference}`,
          nombaReference: `REV-${nombaReference}`,
          nombaWebhookData: payload as object,
          reversalOfId: originalTxn.id,
        },
      });

      await tx.wallet.update({
        where: { id: originalTxn.walletId },
        data: { balanceKobo: { increment: reversalDirection === 'DEBIT' ? -amountKobo : amountKobo } },
      });

      await tx.transaction.update({
        where: { id: originalTxn.id },
        data: { status: 'REVERSED' },
      });
    });
    this.logger.log(`Reversal processed: originalTxnId=${originalTxn.id}`);
  }
}
