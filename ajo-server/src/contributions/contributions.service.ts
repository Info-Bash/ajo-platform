import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { ChatService } from '../chat/chat.service';
import { PayoutsService } from '../payouts/payouts.service';
import { SYSTEM_EVENTS } from '../chat/system-events.const';
import { frequencyDurationMs } from '../groups/utils/frequency.util';
import { effectiveGracePeriodMs } from './utils/grace-period.util';

const toNaira = (kobo: number) => kobo / 100;

@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly chat: ChatService,
    private readonly payouts: PayoutsService,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  async listMyContributions(userId: string, groupId: string) {
    await this.assertMembership(userId, groupId);
    return this.prisma.contribution.findMany({
      where: { groupMember: { groupId, userId } },
      include: { round: { select: { roundNumber: true, startDate: true, endDate: true } } },
      orderBy: { round: { roundNumber: 'asc' } },
    });
  }

  async getGroupSchedule(userId: string, groupId: string) {
    await this.assertMembership(userId, groupId);
    return this.prisma.round.findMany({
      where: { groupId },
      include: {
        payoutMember: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
        contributions: {
          // groupMember's own `userId` scalar comes along for free (no
          // extra select needed) — that's what the frontend uses to work
          // out which contribution row is "mine".
          include: { groupMember: { include: { user: { select: { fullName: true, avatarUrl: true } } } } },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });
  }

  // ─── Pay ──────────────────────────────────────────────────────────────────

  async payContribution(userId: string, contributionId: string) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      include: { groupMember: true, round: { include: { group: true } } },
    });
    if (!contribution) throw new NotFoundException('Contribution not found');
    if (contribution.groupMember.userId !== userId) {
      throw new ForbiddenException('This is not your contribution to pay');
    }
    if (contribution.status === 'PAID') {
      throw new BadRequestException('Already paid');
    }
    if (contribution.status === 'DEFAULTED') {
      throw new BadRequestException(
        'This contribution has already defaulted and closed out for the round',
      );
    }
    if (contribution.round.status !== 'ACTIVE') {
      throw new BadRequestException('This round is no longer accepting payments');
    }

    const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!userWallet) throw new NotFoundException('Wallet not found');
    if (userWallet.balanceKobo < contribution.amountKobo) {
      throw new BadRequestException(
        `Insufficient balance. Available: ₦${toNaira(userWallet.balanceKobo).toFixed(2)}, needed: ₦${toNaira(contribution.amountKobo).toFixed(2)}`,
      );
    }

    const group = contribution.round.group;
    const groupWallet = await this.prisma.wallet.findUnique({ where: { groupId: group.id } });
    if (!groupWallet) throw new NotFoundException('Group wallet not found');

    const wasLate = contribution.status === 'LATE';
    const journalId = `jrnl_con_${uuidv4()}`;
    const userRef = `CONT-PAY-${uuidv4().slice(0, 8).toUpperCase()}`;
    const groupRef = `CONT-RCV-${uuidv4().slice(0, 8).toUpperCase()}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          walletId: userWallet.id,
          direction: 'DEBIT',
          type: 'CONTRIBUTION',
          status: 'SUCCESSFUL',
          amountKobo: contribution.amountKobo,
          journalId,
          reference: userRef,
          description: `Ajo contribution — ${group.name}`,
          groupId: group.id,
          roundId: contribution.roundId,
          contributionId: contribution.id,
        },
      });
      await tx.transaction.create({
        data: {
          walletId: groupWallet.id,
          direction: 'CREDIT',
          type: 'CONTRIBUTION',
          status: 'SUCCESSFUL',
          amountKobo: contribution.amountKobo,
          journalId,
          reference: groupRef,
          description: `Contribution received — ${group.name}`,
          groupId: group.id,
          roundId: contribution.roundId,
          contributionId: contribution.id,
        },
      });

      await tx.wallet.update({ where: { id: userWallet.id }, data: { balanceKobo: { decrement: contribution.amountKobo } } });
      await tx.wallet.update({ where: { id: groupWallet.id }, data: { balanceKobo: { increment: contribution.amountKobo } } });

      await tx.contribution.update({
        where: { id: contribution.id },
        data: { status: 'PAID', paidAt: new Date(), journalId },
      });

      await tx.groupMember.update({
        where: { id: contribution.groupMemberId },
        data: {
          totalPaid: { increment: 1 },
          // Catching up from LATE restores ACTIVE standing.
          ...(wasLate ? { status: 'ACTIVE' } : {}),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          totalContributionsMade: { increment: 1 },
          reputationScore: { increment: 2 },
        },
      });
    });

    // Clamp reputation to 100 (belt-and-braces — increment above is small but let's be safe).
    await this.prisma.user.updateMany({ where: { id: userId, reputationScore: { gt: 100 } }, data: { reputationScore: 100 } });

    this.realtime.emitToGroup(group.id, REALTIME_EVENTS.CONTRIBUTION_MADE, {
      groupId: group.id,
      roundId: contribution.roundId,
      userId,
      amountKobo: contribution.amountKobo,
      wasLate,
    });

    // Someone paying might be exactly what the round was waiting on.
    await this.tryFinalizeRound(contribution.roundId);

    return { message: 'Contribution paid successfully' };
  }

  // ─── Cron entry point (see contributions-cron.service.ts) ──────────────────

  /** Runs the full tick for every group with a currently-ACTIVE round. */
  async processActiveRounds(): Promise<void> {
    const activeRounds = await this.prisma.round.findMany({
      where: { status: 'ACTIVE' },
      include: { group: true, contributions: true },
    });

    for (const round of activeRounds) {
      try {
        await this.sendReminderIfDue(round);
        await this.flipLateContributions(round);
        await this.flipDefaultedContributions(round);
        await this.tryFinalizeRound(round.id);
      } catch (err) {
        this.logger.error(`Error processing round ${round.id}: ${err}`);
      }
    }
  }

  private async sendReminderIfDue(round: {
    id: string;
    groupId: string;
    startDate: Date;
    endDate: Date;
    reminderSentAt: Date | null;
    group: { frequency: string };
  }): Promise<void> {
    if (round.reminderSentAt) return;

    const durationMs = frequencyDurationMs(round.group.frequency);
    const reminderAt = new Date(round.startDate.getTime() + durationMs * (2 / 3));
    if (new Date() < reminderAt) return;

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.round.findUnique({ where: { id: round.id } });
      if (!fresh || fresh.reminderSentAt) return; // race-safe no-op
      await tx.round.update({ where: { id: round.id }, data: { reminderSentAt: new Date() } });
      await this.chat.postSystemMessage(
        tx,
        round.groupId,
        SYSTEM_EVENTS.CONTRIBUTION_REMINDER,
        `⏰ Reminder: contribution for this round is due soon!`,
      );
    });
  }

  private async flipLateContributions(round: {
    id: string;
    contributions: { id: string; status: string; dueDate: Date; groupMemberId: string }[];
  }): Promise<void> {
    const now = new Date();
    const toFlip = round.contributions.filter((c) => c.status === 'PENDING' && now > c.dueDate);

    for (const c of toFlip) {
      const updated = await this.prisma.contribution.updateMany({
        where: { id: c.id, status: 'PENDING' }, // race-safe: only flip if still PENDING
        data: { status: 'LATE' },
      });
      if (updated.count === 0) continue;

      const member = await this.prisma.groupMember.update({
        where: { id: c.groupMemberId },
        data: { status: 'LATE' },
      });

      this.realtime.emitToGroup(member.groupId, REALTIME_EVENTS.CONTRIBUTION_LATE, {
        groupId: member.groupId,
        groupMemberId: member.id,
      });
      await this.realtime
        .notify({
          userId: member.userId,
          groupId: member.groupId,
          type: 'CONTRIBUTION_LATE',
          title: 'Contribution overdue',
          body: 'Your contribution is now late. Pay soon to avoid defaulting.',
        })
        .catch((err) => this.logger.warn(`notify failed: ${err}`));
    }
  }

  private async flipDefaultedContributions(round: {
    id: string;
    groupId: string;
    contributions: { id: string; status: string; dueDate: Date; groupMemberId: string }[];
    group: { frequency: string; gracePeriodHours: number };
  }): Promise<void> {
    const now = new Date();
    const graceMs = effectiveGracePeriodMs(round.group);
    const toFlip = round.contributions.filter(
      (c) => c.status === 'LATE' && now.getTime() > c.dueDate.getTime() + graceMs,
    );

    for (const c of toFlip) {
      const updated = await this.prisma.contribution.updateMany({
        where: { id: c.id, status: 'LATE' },
        data: { status: 'DEFAULTED' },
      });
      if (updated.count === 0) continue;

      const member = await this.prisma.groupMember.update({
        where: { id: c.groupMemberId },
        data: { status: 'INACTIVE', totalMissed: { increment: 1 } },
      });

      await this.prisma.user.update({
        where: { id: member.userId },
        data: {
          totalMissedPayments: { increment: 1 },
          reputationScore: { decrement: 15 },
        },
      });
      await this.prisma.user.updateMany({ where: { id: member.userId, reputationScore: { lt: 0 } }, data: { reputationScore: 0 } });

      this.realtime.emitToGroup(round.groupId, REALTIME_EVENTS.CONTRIBUTION_DEFAULTED, {
        groupId: round.groupId,
        groupMemberId: member.id,
      });
      await this.realtime
        .notify({
          userId: member.userId,
          groupId: round.groupId,
          type: 'CONTRIBUTION_DEFAULTED',
          title: 'Contribution defaulted',
          body: "You missed your contribution's grace period and have been marked inactive in this group.",
        })
        .catch((err) => this.logger.warn(`notify failed: ${err}`));
    }
  }

  /**
   * Finalizes the round once every contribution is resolved (PAID or
   * DEFAULTED — nothing left PENDING/LATE), releasing the payout and
   * advancing to the next round (or completing the group if this was the
   * last one). Safe to call repeatedly — no-ops if not ready or already done.
   */
  private async tryFinalizeRound(roundId: string): Promise<void> {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { contributions: true, group: true, payoutMember: { include: { user: true } } },
    });
    if (!round || round.status !== 'ACTIVE') return;

    const unresolved = round.contributions.some((c) => c.status === 'PENDING' || c.status === 'LATE');
    if (unresolved) return;

    const collectedKobo = round.contributions
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.amountKobo, 0);
    const recipientEligible = ['ACTIVE', 'LATE'].includes(round.payoutMember.status);

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.round.findUnique({ where: { id: roundId } });
      if (!fresh || fresh.status !== 'ACTIVE') return; // race-safe no-op

      await tx.round.update({ where: { id: roundId }, data: { status: 'COMPLETED' } });

      await this.chat.postSystemMessage(
        tx,
        round.groupId,
        SYSTEM_EVENTS.CONTRIBUTION_COMPLETED,
        `✅ Round ${round.roundNumber} contributions are complete.`,
      );

      if (recipientEligible) {
        await this.payouts.releasePayout({
          tx,
          groupId: round.groupId,
          groupName: round.group.name,
          roundId: round.id,
          payoutGroupMemberId: round.payoutMemberId,
          payoutUserId: round.payoutMember.userId,
          amountKobo: collectedKobo,
        });
        await this.chat.postSystemMessage(
          tx,
          round.groupId,
          SYSTEM_EVENTS.PAYOUT_RELEASED,
          `🎉 Payout of ₦${toNaira(collectedKobo).toLocaleString('en-NG')} released to ${round.payoutMember.user.fullName}!`,
        );
      } else {
        await this.payouts.recordWithheldPayout(tx, round.id, round.payoutMemberId, collectedKobo);
        await this.chat.postSystemMessage(
          tx,
          round.groupId,
          SYSTEM_EVENTS.PAYOUT_RELEASED,
          `⚠️ Round ${round.roundNumber}'s payout is on hold — the recipient is no longer in good standing. An admin will need to review this.`,
        );
      }

      await this.advanceOrComplete(tx, round.groupId, round.roundNumber, round.group.cycleLength);
    });

    if (recipientEligible) {
      this.realtime.emitToGroup(round.groupId, REALTIME_EVENTS.PAYOUT_RELEASED, {
        groupId: round.groupId,
        roundId: round.id,
        userId: round.payoutMember.userId,
        amountKobo: collectedKobo,
      });
      await this.realtime
        .notify({
          userId: round.payoutMember.userId,
          groupId: round.groupId,
          type: 'PAYOUT_RECEIVED',
          title: 'Payout received! 🎉',
          body: `₦${toNaira(collectedKobo).toLocaleString('en-NG')} has been added to your wallet.`,
        })
        .catch((err) => this.logger.warn(`notify failed: ${err}`));
    }

    this.logger.log(`Round finalized: id=${roundId} collectedKobo=${collectedKobo}`);
  }

  private async advanceOrComplete(
    tx: any,
    groupId: string,
    completedRoundNumber: number,
    cycleLength: number,
  ): Promise<void> {
    if (completedRoundNumber >= cycleLength) {
      await tx.ajoGroup.update({
        where: { id: groupId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      const members = await tx.groupMember.findMany({ where: { groupId, status: { in: ['ACTIVE', 'LATE'] } } });
      for (const m of members) {
        await tx.user.update({ where: { id: m.userId }, data: { totalGroupsCompleted: { increment: 1 } } });
      }
      await this.chat.postSystemMessage(
        tx,
        groupId,
        SYSTEM_EVENTS.GROUP_COMPLETED,
        `🏁 All rounds complete! This Ajo circle has finished its cycle.`,
      );
      return;
    }

    const nextRoundNumber = completedRoundNumber + 1;
    const nextRound = await tx.round.findUnique({ where: { groupId_roundNumber: { groupId, roundNumber: nextRoundNumber } } });
    if (!nextRound) return; // shouldn't happen — all rounds are pre-generated at activation

    await tx.round.update({ where: { id: nextRound.id }, data: { status: 'ACTIVE' } });
    await tx.ajoGroup.update({ where: { id: groupId }, data: { currentRound: nextRoundNumber } });

    const group = await tx.ajoGroup.findUnique({ where: { id: groupId } });
    const eligibleMembers = await tx.groupMember.findMany({ where: { groupId, status: { in: ['ACTIVE', 'LATE'] } } });

    await tx.contribution.createMany({
      data: eligibleMembers.map((m: { id: string }) => ({
        roundId: nextRound.id,
        groupMemberId: m.id,
        amountKobo: group!.memberShareKobo,
        dueDate: nextRound.endDate,
      })),
    });

    await this.chat.postSystemMessage(
      tx,
      groupId,
      SYSTEM_EVENTS.ROUND_ADVANCED,
      `🔔 Round ${nextRoundNumber} has begun!`,
    );
  }

  private async assertMembership(userId: string, groupId: string): Promise<void> {
    const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!membership) throw new ForbiddenException('You are not a member of this group');
  }
}
