import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { NombaService } from '../nomba/nomba.service';
import { AppConfig } from '../config/app.config';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import {
  FundWalletDto,
  TransferDto,
  GetTransactionsDto,
} from './dto/wallet.dto';

const NAIRA_TO_KOBO = 100;
const toKobo = (naira: number) => Math.round(naira * NAIRA_TO_KOBO);
const toNaira = (kobo: number) => kobo / NAIRA_TO_KOBO;

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
}