/**
 * WebhooksService
 *
 * Processes every inbound Nomba webhook event.
 * Only one event type currently matters for our internal ledger: payment_success
 * with transaction.type === "vact_transfer" — that means money hit one of our
 * users' virtual accounts (a deposit).
 *
 * Double-entry on deposit:
 *   DEBIT  → platform_float wallet  (Nomba holds the real money)
 *   CREDIT → user wallet            (internal balance the user can spend)
 *
 * Both rows share a journalId so the pair is always findable.
 *
 * Idempotency: we key on nombaReference (Nomba's transactionId).
 * If the same webhook fires twice (Nomba retries on 5xx), the second
 * call is a no-op — we return 200 immediately so Nomba stops retrying.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NombaWebhookPayload } from './nomba-webhook.types';
import {
  TransactionType,
  TransactionDirection,
  TransactionStatus,
} from '@prisma/client';

// Naira → kobo conversion (Nomba sends amounts in Naira float)
const toKobo = (naira: number): number => Math.round(naira * 100);

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleEvent(payload: NombaWebhookPayload): Promise<void> {
    const { event_type, requestId, data } = payload;

    this.logger.log(
      `Nomba webhook received: event=${event_type} requestId=${requestId} ` +
        `txId=${data?.transaction?.transactionId}`,
    );

    switch (event_type) {
      case 'payment_success':
        await this.handlePaymentSuccess(payload);
        break;

      case 'payout_success':
        // Nomba confirmed a bank payout we initiated. Log for now — the
        // internal ledger entry was already created when we initiated the
        // withdrawal. We'll reconcile the nombaStatus field here.
        await this.handlePayoutSuccess(payload);
        break;

      case 'payment_failed':
      case 'payout_failed':
        await this.handleTransactionFailed(payload);
        break;

      case 'payment_reversal':
      case 'payout_refund':
        await this.handleReversal(payload);
        break;

      default:
        this.logger.warn(`Unhandled Nomba event type: ${event_type as string}`);
    }
  }

  // ─── payment_success ───────────────────────────────────────────────────────

  private async handlePaymentSuccess(
    payload: NombaWebhookPayload,
  ): Promise<void> {
    const { requestId, data } = payload;
    const { merchant, transaction, customer } = data;

    const nombaReference = transaction.transactionId;
    const amountKobo = toKobo(transaction.transactionAmount);

    // ── Idempotency check ────────────────────────────────────────────────────
    const existing = await this.prisma.transaction.findFirst({
      where: { nombaReference },
    });

    if (existing) {
      this.logger.log(
        `Duplicate Nomba webhook — already processed ${nombaReference}`,
      );
      return;
    }

    // ── Find the wallet that received the deposit ────────────────────────────
    // aliasAccountNumber is the virtual account number that received funds.
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        nombaVirtualAccountNumber: transaction.aliasAccountNumber,
      },
      include: { user: true },
    });

    if (!wallet) {
      this.logger.warn(
        `payment_success for unknown virtual account ${transaction.aliasAccountNumber} ` +
          `(requestId=${requestId}). Possible: account not yet provisioned in our DB.`,
      );
      // Still return — we don't want Nomba to keep retrying a webhook we
      // genuinely can't handle yet. Log for manual reconciliation.
      return;
    }

    if (!wallet.userId) {
      this.logger.warn(
        `Wallet ${wallet.id} matched virtual account but has no userId — skipping deposit`,
      );
      return;
    }

    const journalId = `jrnl_dep_${nombaReference}`;
    const description = `Deposit via ${customer.senderName ?? 'bank transfer'} — ${transaction.type}`;
    const senderName = customer.senderName ?? 'Unknown sender';

    // ── Double-entry: CREDIT the user wallet ─────────────────────────────────
    // We do not maintain a separate platform_float wallet in this schema yet,
    // so we only write the user-side CREDIT entry.
    // When a platform float wallet is added, add the DEBIT entry here too.
    await this.prisma.$transaction(async (tx) => {
      // 1. Credit user wallet
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          direction: TransactionDirection.CREDIT,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.SUCCESSFUL,
          amountKobo,
          journalId,
          description,
          counterpartyName: senderName,
          nombaReference,
          nombaWebhookData: payload as object,
        },
      });

      // 2. Update wallet balance cache
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceKobo: { increment: amountKobo } },
      });

      this.logger.log(
        `Deposit credited: walletId=${wallet.id} userId=${wallet.userId} ` +
          `amount=₦${transaction.transactionAmount} kobo=${amountKobo} ` +
          `nombaRef=${nombaReference}`,
      );
    });
  }

  // ─── payout_success ────────────────────────────────────────────────────────

  private async handlePayoutSuccess(
    payload: NombaWebhookPayload,
  ): Promise<void> {
    const { data } = payload;
    const nombaReference = data.transaction.transactionId;

    // Find the pending withdrawal transaction and mark it SUCCESSFUL
    const txn = await this.prisma.transaction.findFirst({
      where: {
        nombaReference,
        type: TransactionType.WITHDRAWAL,
      },
    });

    if (!txn) {
      this.logger.warn(
        `payout_success for unknown nombaReference=${nombaReference}`,
      );
      return;
    }

    await this.prisma.transaction.update({
      where: { id: txn.id },
      data: {
        status: TransactionStatus.SUCCESSFUL,
        nombaWebhookData: payload as object,
      },
    });

    this.logger.log(`Withdrawal confirmed: txnId=${txn.id} nombaRef=${nombaReference}`);
  }

  // ─── payment_failed / payout_failed ───────────────────────────────────────

  private async handleTransactionFailed(
    payload: NombaWebhookPayload,
  ): Promise<void> {
    const { event_type, data } = payload;
    const nombaReference = data.transaction.transactionId;

    const txn = await this.prisma.transaction.findFirst({
      where: { nombaReference },
    });

    if (!txn) {
      this.logger.warn(
        `${event_type} for unknown nombaReference=${nombaReference}`,
      );
      return;
    }

    await this.prisma.transaction.update({
      where: { id: txn.id },
      data: {
        status: TransactionStatus.FAILED,
        nombaWebhookData: payload as object,
      },
    });

    this.logger.warn(
      `Transaction failed: txnId=${txn.id} event=${event_type} nombaRef=${nombaReference}`,
    );
  }

  // ─── payment_reversal / payout_refund ─────────────────────────────────────

  private async handleReversal(payload: NombaWebhookPayload): Promise<void> {
    const { event_type, data } = payload;
    const nombaReference = data.transaction.transactionId;
    const amountKobo = toKobo(data.transaction.transactionAmount);

    // Find the original transaction that is being reversed
    const originalTxn = await this.prisma.transaction.findFirst({
      where: { nombaReference },
      include: { wallet: true },
    });

    if (!originalTxn) {
      this.logger.warn(
        `${event_type}: no original transaction found for nombaRef=${nombaReference}`,
      );
      return;
    }

    const reversalJournalId = `jrnl_rev_${nombaReference}`;

    await this.prisma.$transaction(async (tx) => {
      // Create reversal entry (opposite direction to the original)
      const reversalDirection =
        originalTxn.direction === TransactionDirection.CREDIT
          ? TransactionDirection.DEBIT
          : TransactionDirection.CREDIT;

      await tx.transaction.create({
        data: {
          walletId: originalTxn.walletId,
          direction: reversalDirection,
          type: TransactionType.REVERSAL,
          status: TransactionStatus.SUCCESSFUL,
          amountKobo,
          journalId: reversalJournalId,
          description: `Reversal of ${nombaReference}`,
          nombaReference: `REV-${nombaReference}`,
          nombaWebhookData: payload as object,
          reversalOfId: originalTxn.id,
        },
      });

      // Adjust wallet balance: if original was a CREDIT, deduct it back
      const balanceDelta =
        reversalDirection === TransactionDirection.DEBIT
          ? -amountKobo
          : amountKobo;

      await tx.wallet.update({
        where: { id: originalTxn.walletId },
        data: { balanceKobo: { increment: balanceDelta } },
      });

      // Mark original as REVERSED
      await tx.transaction.update({
        where: { id: originalTxn.id },
        data: { status: TransactionStatus.REVERSED },
      });

      this.logger.log(
        `Reversal processed: originalTxnId=${originalTxn.id} ` +
          `walletId=${originalTxn.walletId} amountKobo=${amountKobo}`,
      );
    });
  }
}
