import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Accepts either the top-level PrismaService or a $transaction client, so
// callers (GroupsService) can link friendships atomically alongside the
// membership row that triggered them.
type PrismaTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Auto-friends a newly-joined member with every other ACTIVE member of the
   * group (spec: "members of the same Ajo group automatically become
   * friends"). Skips itself, is idempotent (upsert), and creates friendships
   * directly as ACCEPTED — no request/accept step, since group co-membership
   * is itself the trust signal.
   */
  async linkNewMemberWithGroup(
    tx: PrismaTx,
    groupId: string,
    newUserId: string,
  ): Promise<void> {
    const otherMembers = await tx.groupMember.findMany({
      where: { groupId, userId: { not: newUserId }, status: 'ACTIVE' },
      select: { userId: true },
    });

    for (const { userId: otherUserId } of otherMembers) {
      await this.upsertAcceptedFriendship(tx, newUserId, otherUserId);
    }
  }

  /** Normalises pair order (lexicographic) so a pair never gets two rows. */
  private async upsertAcceptedFriendship(
    tx: PrismaTx,
    userIdA: string,
    userIdB: string,
  ): Promise<void> {
    if (userIdA === userIdB) return;
    const [initiatorId, receiverId] =
      userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];

    await tx.friendship.upsert({
      where: { initiatorId_receiverId: { initiatorId, receiverId } },
      create: { initiatorId, receiverId, status: 'ACCEPTED' },
      update: { status: 'ACCEPTED' },
    });
  }

  async listFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ initiatorId: userId }, { receiverId: userId }],
      },
      include: {
        initiator: { select: { id: true, fullName: true, avatarUrl: true, reputationScore: true } },
        receiver: { select: { id: true, fullName: true, avatarUrl: true, reputationScore: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return friendships.map((f) => {
      const friend = f.initiatorId === userId ? f.receiver : f.initiator;
      return {
        friendshipId: f.id,
        userId: friend.id,
        fullName: friend.fullName,
        avatarUrl: friend.avatarUrl,
        reputationScore: friend.reputationScore,
        friendsSince: f.createdAt,
      };
    });
  }
}
