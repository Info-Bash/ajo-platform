import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

type PrismaTx = PrismaService | Prisma.TransactionClient;

export interface ReleasePayoutParams {
  tx: PrismaTx;
  groupId: string;
  groupName: string;
  roundId: string;
  payoutGroupMemberId: string;
  payoutUserId: string;
  amountKobo: number; // actual amount collected for the round (may be < the full pot if some defaulted)
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Moves `amountKobo` from the group wallet to the payout recipient's
   * personal wallet (internal ledger transfer — no Nomba call; the member
   * can withdraw to their bank afterwards via the existing wallet/withdraw flow).
   * Caller decides eligibility (e.g. skips this entirely if the recipient
   * has since DEFAULTED/EXITED) and must run this inside the same
   * transaction as the round-finalization writes for atomicity.
   */
  async releasePayout(params: ReleasePayoutParams) {
    const { tx, groupId, groupName, roundId, payoutGroupMemberId, payoutUserId, amountKobo } = params;

    if (amountKobo <= 0) {
      this.logger.warn(`Skipping zero-amount payout: round=${roundId}`);
      return null;
    }

    const groupWallet = await tx.wallet.findUnique({ where: { groupId } });
    const userWallet = await tx.wallet.findUnique({ where: { userId: payoutUserId } });
    if (!groupWallet || !userWallet) {
      throw new Error(`Missing wallet(s) for payout: group=${groupId} user=${payoutUserId}`);
    }

    const journalId = `jrnl_pay_${uuidv4()}`;
    const groupRef = `PAYOUT-GRP-${uuidv4().slice(0, 8).toUpperCase()}`;
    const userRef = `PAYOUT-RCV-${uuidv4().slice(0, 8).toUpperCase()}`;

    await tx.transaction.create({
      data: {
        walletId: groupWallet.id,
        direction: 'DEBIT',
        type: 'PAYOUT',
        status: 'SUCCESSFUL',
        amountKobo,
        journalId,
        reference: groupRef,
        description: `Payout released for ${groupName}`,
        groupId,
        roundId,
      },
    });

    await tx.transaction.create({
      data: {
        walletId: userWallet.id,
        direction: 'CREDIT',
        type: 'PAYOUT',
        status: 'SUCCESSFUL',
        amountKobo,
        journalId,
        reference: userRef,
        description: `Ajo payout from ${groupName}`,
        groupId,
        roundId,
      },
    });

    await tx.wallet.update({ where: { id: groupWallet.id }, data: { balanceKobo: { decrement: amountKobo } } });
    await tx.wallet.update({ where: { id: userWallet.id }, data: { balanceKobo: { increment: amountKobo } } });

    const payout = await tx.payout.create({
      data: {
        roundId,
        groupMemberId: payoutGroupMemberId,
        status: 'RELEASED',
        amountKobo,
        releasedAt: new Date(),
        journalId,
      },
    });

    await tx.groupMember.update({
      where: { id: payoutGroupMemberId },
      data: { payoutReceivedAt: new Date() },
    });

    await tx.round.update({ where: { id: roundId }, data: { payoutReleasedAt: new Date() } });

    this.logger.log(`Payout released: round=${roundId} member=${payoutGroupMemberId} amountKobo=${amountKobo}`);
    return payout;
  }

  /**
   * Records a payout as withheld (recipient no longer eligible — e.g. they
   * DEFAULTED or EXITED before their round completed). Funds stay in the
   * group wallet; resolving this is a manual/future admin action.
   */
  async recordWithheldPayout(tx: PrismaTx, roundId: string, payoutGroupMemberId: string, amountKobo: number) {
    return tx.payout.create({
      data: { roundId, groupMemberId: payoutGroupMemberId, status: 'PENDING', amountKobo },
    });
  }
}
