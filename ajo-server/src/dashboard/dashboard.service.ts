import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const toNaira = (kobo: number) => kobo / 100;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async getSummary(userId: string) {
    const [wallet, transactionsResult, activeGroupsCount, completedGroupsCount, exitedGroupsCount, nextContribution, nextPayout] =
      await Promise.all([
        this.walletService.getWallet(userId),
        this.walletService.getTransactions(userId, { page: 1, limit: 5 }),
        this.prisma.groupMember.count({
          where: { userId, status: { in: ['ACTIVE', 'LATE'] }, group: { status: 'ACTIVE' } },
        }),
        this.prisma.groupMember.count({
          where: { userId, group: { status: 'COMPLETED' } },
        }),
        // No "leave an active group" flow exists yet — INACTIVE (defaulted out
        // of the rotation) is the closest real-world equivalent for now.
        this.prisma.groupMember.count({
          where: { userId, status: { in: ['EXITED', 'INACTIVE'] } },
        }),
        this.getNextContribution(userId),
        this.getNextPayout(userId),
      ]);

    return {
      wallet,
      activeGroupsCount,
      completedGroupsCount,
      exitedGroupsCount,
      nextContribution,
      nextPayout,
      recentTransactions: transactionsResult.data,
    };
  }

  private async getNextContribution(userId: string) {
    const contribution = await this.prisma.contribution.findFirst({
      where: {
        status: { in: ['PENDING', 'LATE'] },
        groupMember: { userId, status: { in: ['ACTIVE', 'LATE'] } },
      },
      orderBy: { dueDate: 'asc' },
      include: { round: { include: { group: { select: { id: true, name: true } } } } },
    });
    if (!contribution) return null;

    const daysUntilDue = Math.ceil((contribution.dueDate.getTime() - Date.now()) / DAY_MS);

    return {
      groupId: contribution.round.group.id,
      groupName: contribution.round.group.name,
      amountKobo: contribution.amountKobo,
      amountNaira: toNaira(contribution.amountKobo),
      dueDate: contribution.dueDate,
      daysUntilDue,
    };
  }

  private async getNextPayout(userId: string) {
    const round = await this.prisma.round.findFirst({
      where: {
        payoutReleasedAt: null,
        status: { in: ['ACTIVE', 'UPCOMING'] },
        payoutMember: { userId },
      },
      orderBy: { roundNumber: 'asc' },
      include: { group: { select: { id: true, name: true, contributionAmountKobo: true } } },
    });
    if (!round) return null;

    return {
      groupId: round.group.id,
      groupName: round.group.name,
      amountKobo: round.group.contributionAmountKobo,
      amountNaira: toNaira(round.group.contributionAmountKobo),
      round: round.roundNumber,
    };
  }
}
