import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
import { AppConfig } from '../config/app.config';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import {
  FundWalletDto,
  TransferDto,
  GetTransactionsDto,
  WithdrawDto,
  ResolveBankAccountDto,
  SetTransactionPinDto,
} from './dto/wallet.dto';

const NAIRA_TO_KOBO = 100;
const toKobo = (naira: number) => Math.round(naira * NAIRA_TO_KOBO);
const toNaira = (kobo: number) => kobo / NAIRA_TO_KOBO;
const BCRYPT_ROUNDS = 12; // matches auth.service.ts's PIN/password hashing cost

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nomba: NombaService,
    private readonly config: ConfigService<AppConfig>,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Get Wallet ───────────────────────────────────────────────────────────

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: {
        id: true,
        accountNumber: true,
        balanceKobo: true,
        createdAt: true,
      },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');

    return {
      id: wallet.id,
      accountNumber: wallet.accountNumber,
      balanceKobo: wallet.balanceKobo,
      balanceNaira: toNaira(wallet.balanceKobo),
      createdAt: wallet.createdAt,
    };
  }

  // ─── Fund Wallet (Nomba Checkout) ─────────────────────────────────────────

  async fundWallet(userId: string, dto: FundWalletDto) {
    const amountKobo = toKobo(dto.amount);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true, wallet: { select: { id: true } } },
    });
    if (!user?.wallet) throw new NotFoundException('Wallet not found');

    const frontendUrl =
      process.env.FRONTEND_URL ?? 'https://ajo-app-eta.vercel.app';

    // Unique order reference — we generate it so we can track it in PendingCheckout
    const orderRef = uuidv4();

    // Create Nomba checkout order.
    // NOTE: we deliberately ignore the `orderReference` Nomba's create-order
    // response echoes back — it isn't reliably identical to the `orderRef`
    // we submitted, and the payment_success webhook later comes back with
    // OUR submitted reference at data.order.orderReference, not whatever
    // Nomba's create-order response contained. Trusting the response value
    // here caused PendingCheckout to be saved under the wrong key, so the
    // webhook could never find it. `orderRef` is the only value guaranteed
    // to match what the webhook will send.
    const { checkoutLink } = await this.nomba.createCheckoutOrder({
      amountKobo,
      currency: 'NGN',
      orderRef,
      customerEmail: user.email,
      customerId: userId,
      accountId: this.config.get('nomba').subAccountId,
      allowedPaymentMethods: ['Card', 'Transfer'],
      callbackUrl: `${frontendUrl}/wallet?status=funded`,
      tokenizeCard: true, // save card for future contributions
      metadata: {
        userId,
        walletId: user.wallet.id,
        type: 'wallet_funding',
      },
    });

    // Save PendingCheckout so webhook can match this order back to the wallet
    await this.prisma.pendingCheckout.create({
      data: {
        walletId: user.wallet.id,
        userId,
        orderReference: orderRef,
        amountKobo,
        checkoutLink,
        // Expire after 30 minutes — if user abandons checkout
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    this.logger.log(
      `Checkout order created: userId=${userId} amount=₦${dto.amount} orderRef=${orderRef}`,
    );

    return {
      checkoutLink,
      orderReference: orderRef,
      amount: dto.amount,
      amountKobo,
    };
  }

  // ─── Internal Transfer ────────────────────────────────────────────────────

  async transfer(senderUserId: string, dto: TransferDto) {
    const amountKobo = toKobo(dto.amount);

    // Look up sender wallet
    const senderWallet = await this.prisma.wallet.findUnique({
      where: { userId: senderUserId },
      include: { user: { select: { fullName: true } } },
    });
    if (!senderWallet) throw new NotFoundException('Sender wallet not found');
    if (!senderWallet.user) {
      throw new NotFoundException('Sender account is not a personal wallet');
    }

    // Sufficient balance check
    if (senderWallet.balanceKobo < amountKobo) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₦${toNaira(senderWallet.balanceKobo).toFixed(2)}`,
      );
    }

    // Look up recipient by account number
    const recipientWallet = await this.prisma.wallet.findUnique({
      where: { accountNumber: dto.accountNumber },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!recipientWallet || !recipientWallet.user) {
      throw new NotFoundException(
        'No Ajo account found with that account number',
      );
    }

    // Prevent self-transfer
    if (recipientWallet.userId === senderUserId) {
      throw new BadRequestException('You cannot transfer to your own wallet');
    }

    const journalId = `jrnl_trf_${uuidv4()}`;
    const senderRef = `TRF-SND-${uuidv4().slice(0, 8).toUpperCase()}`;
    const recipientRef = `TRF-RCV-${uuidv4().slice(0, 8).toUpperCase()}`;
    const description =
      dto.description?.trim() || `Transfer to ${recipientWallet.user.fullName}`;
    const senderFullName = senderWallet.user.fullName;

    await this.prisma.$transaction(async (tx) => {
      // DEBIT sender
      await tx.transaction.create({
        data: {
          walletId: senderWallet.id,
          direction: 'DEBIT',
          type: 'TRANSFER',
          status: 'SUCCESSFUL',
          amountKobo,
          journalId,
          reference: senderRef,
          description,
          counterpartyUserId: recipientWallet.user!.id,
          counterpartyName: recipientWallet.user!.fullName,
        },
      });

      // CREDIT recipient
      await tx.transaction.create({
        data: {
          walletId: recipientWallet.id,
          direction: 'CREDIT',
          type: 'TRANSFER',
          status: 'SUCCESSFUL',
          amountKobo,
          journalId,
          reference: recipientRef,
          description: `Transfer from ${senderFullName}`,
          counterpartyUserId: senderUserId,
          counterpartyName: senderFullName,
        },
      });

      // Update balances
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { balanceKobo: { decrement: amountKobo } },
      });
      await tx.wallet.update({
        where: { id: recipientWallet.id },
        data: { balanceKobo: { increment: amountKobo } },
      });
    });

    this.logger.log(
      `Transfer: ₦${dto.amount} from userId=${senderUserId} to accountNo=${dto.accountNumber} journalId=${journalId}`,
    );

    const amountLabel = `₦${dto.amount.toLocaleString('en-NG')}`;

    // Live push + persisted notification for both sides of the transfer.
    // Fire-and-forget from the caller's perspective — a socket hiccup or
    // notification-write failure should never fail a transfer that already
    // committed to the ledger.
    this.emitTransferEvents({
      senderUserId,
      senderName: senderFullName,
      recipientUserId: recipientWallet.user.id,
      recipientName: recipientWallet.user.fullName,
      amount: dto.amount,
      amountLabel,
      senderRef,
      recipientRef,
    });

    return {
      message: `₦${dto.amount.toLocaleString('en-NG')} sent to ${recipientWallet.user.fullName}`,
      reference: senderRef,
      amount: dto.amount,
      recipient: {
        name: recipientWallet.user.fullName,
        accountNumber: dto.accountNumber,
      },
    };
  }

  // ─── Realtime helpers ───────────────────────────────────────────────────

  private emitTransferEvents(input: {
    senderUserId: string;
    senderName: string;
    recipientUserId: string;
    recipientName: string;
    amount: number;
    amountLabel: string;
    senderRef: string;
    recipientRef: string;
  }): void {
    // Dedicated event — client uses this to invalidate wallet/transactions
    // queries without parsing the generic notification envelope.
    this.realtime.emitToUser(input.senderUserId, REALTIME_EVENTS.WALLET_TRANSFER, {
      direction: 'DEBIT',
      amount: input.amount,
      reference: input.senderRef,
      counterpartyName: input.recipientName,
    });
    this.realtime.emitToUser(input.recipientUserId, REALTIME_EVENTS.WALLET_TRANSFER, {
      direction: 'CREDIT',
      amount: input.amount,
      reference: input.recipientRef,
      counterpartyName: input.senderName,
    });

    // Persisted notification feed entry for each side.
    this.realtime
      .notify({
        userId: input.senderUserId,
        type: 'WALLET_TRANSFER',
        title: 'Transfer sent',
        body: `You sent ${input.amountLabel} to ${input.recipientName}`,
      })
      .catch((err) =>
        this.logger.warn(`Failed to save sender transfer notification: ${err}`),
      );

    this.realtime
      .notify({
        userId: input.recipientUserId,
        type: 'WALLET_TRANSFER',
        title: 'Transfer received',
        body: `${input.senderName} sent you ${input.amountLabel}`,
      })
      .catch((err) =>
        this.logger.warn(`Failed to save recipient transfer notification: ${err}`),
      );
  }

  // ─── Transaction History ─────────────────────────────────────────────────

  async getTransactions(userId: string, dto: GetTransactionsDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100); // cap at 100 per page
    const skip = (page - 1) * limit;

    const where = {
      walletId: wallet.id,
      ...(dto.type && { type: dto.type as never }),
    };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          direction: true,
          type: true,
          status: true,
          amountKobo: true,
          reference: true,
          description: true,
          counterpartyName: true,
          groupId: true,
          nombaOrderReference: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((tx) => ({
        ...tx,
        amountNaira: toNaira(tx.amountKobo),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  // ─── Lookup account by number (for transfer recipient preview) ────────────

  async lookupAccount(accountNumber: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { accountNumber },
      select: {
        accountNumber: true,
        user: { select: { fullName: true, avatarUrl: true } },
      },
    });

    if (!wallet?.user) {
      throw new NotFoundException(
        'No Ajo account found with that account number',
      );
    }

    // Return minimal info — just enough for the "confirm recipient" UI step
    return {
      accountNumber: wallet.accountNumber,
      name: wallet.user.fullName,
      avatarUrl: wallet.user.avatarUrl,
    };
  }

  // ─── Bank Withdrawal (Nomba Payout) ────────────────────────────────────────

  /** List of Nomba-supported banks for the "select bank" step. Cached by NombaService. */
  async getBankList() {
    return this.nomba.getBankList();
  }

  /** Verify a destination account and return its real account name before withdrawal. */
  async resolveBankAccount(dto: ResolveBankAccountDto) {
    return this.nomba.resolveBankAccount({
      accountNumber: dto.accountNumber,
      bankCode: dto.bankCode,
    });
  }

  /** List the user's saved external-bank beneficiaries (most recent first). */
  async listBeneficiaries(userId: string) {
    return this.prisma.beneficiary.findMany({
      where: { userId, bankCode: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setTransactionPin(userId: string, dto: SetTransactionPinDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { transactionPinHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.transactionPinHash) {
      if (!dto.currentPin) {
        throw new BadRequestException('Current PIN is required to change your PIN');
      }
      const matches = await bcrypt.compare(dto.currentPin, user.transactionPinHash);
      if (!matches) throw new BadRequestException('Current PIN is incorrect');
    }

    const transactionPinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { transactionPinHash } });

    return { message: 'Transaction PIN set successfully' };
  }

  /**
   * Withdraws funds from the user's wallet to an external bank account via
   * Nomba payout.
   *
   * Flow, in order:
   *  1. Verify the transaction PIN.
   *  2. Resolve destination details (from a saved beneficiary or a fresh
   *     accountNumber/bankCode) and re-verify the account name with Nomba
   *     right before transferring — even for saved beneficiaries, since a
   *     bank account can be closed or renamed after being saved.
   *  3. Debit the wallet and create a PENDING WITHDRAWAL transaction FIRST,
   *     using our own generated `merchantTxRef` as the transaction's
   *     `reference` — this is what the payout webhook will echo back, and
   *     is what we match against (see webhooks.service.ts). We debit before
   *     calling Nomba, mirroring the existing pattern noted in
   *     webhooks.service.ts's handleFailed(): if the payout fails, the
   *     webhook credits it back; this way the money is never briefly
   *     "spendable twice" between debit and payout confirmation.
   *  4. Auto-save the destination as a Beneficiary (upsert, so repeat
   *     withdrawals to the same account don't create duplicates).
   *  5. Call Nomba to initiate the payout, and reconcile the transaction's
   *     status based on the *synchronous* response (SUCCESS / REFUND) where
   *     possible — otherwise leave it PENDING for the webhook to resolve.
   */
  async withdraw(userId: string, dto: WithdrawDto) {
    if (!dto.beneficiaryId && !(dto.accountNumber && dto.bankCode)) {
      throw new BadRequestException(
        'Provide either beneficiaryId or both accountNumber and bankCode',
      );
    }

    const amountKobo = toKobo(dto.amount);

    const [user, wallet] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, transactionPinHash: true },
      }),
      this.prisma.wallet.findUnique({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!wallet) throw new NotFoundException('Wallet not found');

    if (!user.transactionPinHash) {
      throw new BadRequestException(
        'Set a transaction PIN before withdrawing (POST /wallet/pin)',
      );
    }
    const pinMatches = await bcrypt.compare(dto.pin, user.transactionPinHash);
    if (!pinMatches) throw new BadRequestException('Incorrect transaction PIN');

    if (wallet.balanceKobo < amountKobo) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₦${toNaira(wallet.balanceKobo).toFixed(2)}`,
      );
    }

    // Resolve destination account number/bankCode from either the saved
    // beneficiary or the raw fields the caller supplied.
    let accountNumber: string;
    let bankCode: string;

    if (dto.beneficiaryId) {
      const beneficiary = await this.prisma.beneficiary.findUnique({
        where: { id: dto.beneficiaryId },
      });
      if (!beneficiary || beneficiary.userId !== userId || !beneficiary.bankCode) {
        throw new NotFoundException('Beneficiary not found');
      }
      accountNumber = beneficiary.accountNumber;
      bankCode = beneficiary.bankCode;
    } else {
      accountNumber = dto.accountNumber!;
      bankCode = dto.bankCode!;
    }

    // Always re-verify with Nomba immediately before transferring, even for
    // a saved beneficiary — accounts can be closed/renamed after saving.
    const { accountName } = await this.nomba.resolveBankAccount({ accountNumber, bankCode });

    const merchantTxRef = uuidv4();
    const journalId = `jrnl_wd_${merchantTxRef}`;

    // 1. Debit upfront and record PENDING — see method doc for why.
    const transaction = await this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          direction: 'DEBIT',
          type: 'WITHDRAWAL',
          status: 'PENDING',
          amountKobo,
          journalId,
          reference: merchantTxRef,
          description: dto.narration?.trim() || `Withdrawal to ${accountName}`,
          counterpartyName: accountName,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceKobo: { decrement: amountKobo } },
      });

      return txn;
    });

    // 2. Auto-save/refresh this destination as a beneficiary for next time.
    const bank = (await this.nomba.getBankList()).find((b) => b.code === bankCode);
    await this.prisma.beneficiary
      .upsert({
        where: {
          userId_accountNumber_bankCode: { userId, accountNumber, bankCode },
        },
        create: {
          userId,
          name: accountName,
          accountNumber,
          bankCode,
          bankName: bank?.name ?? 'Unknown Bank',
        },
        update: { name: accountName, bankName: bank?.name ?? 'Unknown Bank' },
      })
      .catch((err) =>
        // Non-fatal — the withdrawal itself must not fail just because the
        // beneficiary bookkeeping had an issue.
        this.logger.warn(`Failed to upsert beneficiary for userId=${userId}: ${err}`),
      );

    this.logger.log(
      `Withdrawal initiated: userId=${userId} amount=₦${dto.amount} merchantTxRef=${merchantTxRef}`,
    );

    // 3. Initiate the payout. If this throws, the transaction stays PENDING
    // (money already debited) and is resolved later by the webhook — we do
    // NOT refund here, since we may not actually know whether Nomba
    // received/executed the request.
    let payoutResult: { nombaTransferId: string | null; status: string };
    try {
      payoutResult = await this.nomba.createBankPayout({
        amountKobo,
        accountNumber,
        accountName,
        bankCode,
        merchantTxRef,
        senderName: user.fullName,
        narration: dto.narration,
      });
    } catch (err) {
      return {
        message: `₦${dto.amount.toLocaleString('en-NG')} withdrawal is processing`,
        reference: merchantTxRef,
        amount: dto.amount,
        status: 'PENDING',
        recipient: { name: accountName, accountNumber },
      };
    }

    // 4. Reconcile against the synchronous response where we can.
    if (payoutResult.status === 'REFUND') {
      // Failed immediately — refund now rather than waiting on a webhook
      // that may or may not additionally arrive (handleFailed() is
      // idempotent on transaction status, so no double-refund risk if it does).
      await this.prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED', nombaReference: payoutResult.nombaTransferId },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balanceKobo: { increment: amountKobo } },
        });
      });
      throw new BadRequestException('Withdrawal failed. Your wallet has been refunded.');
    }

    if (payoutResult.status === 'SUCCESS') {
      // Mark successful now for a snappier response; handlePayoutSuccess()
      // in webhooks.service.ts checks status before acting, so a webhook
      // arriving moments later for the same merchantTxRef is a no-op.
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESSFUL', nombaReference: payoutResult.nombaTransferId },
      });
    } else if (payoutResult.nombaTransferId) {
      // PENDING_BILLING / NEW — store the transfer ID for audit/requery even
      // though the webhook (matched via merchantTxRef) is what finalizes status.
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: { nombaReference: payoutResult.nombaTransferId },
      });
    }

    return {
      message: `₦${dto.amount.toLocaleString('en-NG')} sent to ${accountName}`,
      reference: merchantTxRef,
      amount: dto.amount,
      status: payoutResult.status === 'SUCCESS' ? 'SUCCESSFUL' : 'PENDING',
      recipient: { name: accountName, accountNumber },
    };
  }
}