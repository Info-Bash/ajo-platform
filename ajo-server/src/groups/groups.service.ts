import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ChatService } from '../chat/chat.service';
import { FriendsService } from '../friends/friends.service';
import { SYSTEM_EVENTS } from '../chat/system-events.const';
import { AppConfig } from '../config/app.config';
import { generateAccountNumber } from '../common/utils/account-number.util';
import { frequencyDurationMs, isTestingFrequencyAllowed } from './utils/frequency.util';
import {
  CreateGroupDto,
  RequestToJoinDto,
  ReviewJoinRequestDto,
  ListPublicGroupsDto,
  InviteUserDto,
} from './dto/groups.dto';

const NAIRA_TO_KOBO = 100;
const toKobo = (naira: number) => Math.round(naira * NAIRA_TO_KOBO);

// Invite codes: short, unambiguous alphabet (no 0/O/1/I confusion).
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig>,
    private readonly realtime: RealtimeService,
    private readonly chat: ChatService,
    private readonly friends: FriendsService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateGroupDto) {
    if (
      dto.frequency === 'TESTING' &&
      !isTestingFrequencyAllowed(this.config.get('nodeEnv', { infer: true })!)
    ) {
      throw new BadRequestException(
        'The TESTING frequency is only available outside production',
      );
    }

    const memberShareKobo = toKobo(dto.memberShareAmount);
    const contributionAmountKobo = memberShareKobo * dto.cycleLength;

    const inviteCode = await this.generateUniqueInviteCode();

    const group = await this.prisma.$transaction(async (tx) => {
      const newGroup = await tx.ajoGroup.create({
        data: {
          creatorId: userId,
          name: dto.name,
          description: dto.description,
          memberShareKobo,
          contributionAmountKobo,
          cycleLength: dto.cycleLength,
          frequency: dto.frequency as never,
          visibility: dto.visibility as never,
          activationMode: dto.activationMode as never,
          gracePeriodHours: dto.gracePeriodHours ?? 48,
          inviteCode,
        },
      });

      // Group wallet — holds pooled contributions until payout.
      let accountNumber = generateAccountNumber();
      while (await tx.wallet.findUnique({ where: { accountNumber } })) {
        accountNumber = generateAccountNumber();
      }
      await tx.wallet.create({
        data: { groupId: newGroup.id, accountNumber, balanceKobo: 0 },
      });

      // Creator is the first member (payoutOrder 1) and group ADMIN.
      await tx.groupMember.create({
        data: {
          groupId: newGroup.id,
          userId,
          role: 'ADMIN',
          payoutOrder: 1,
          payoutRound: 1,
        },
      });

      await this.chat.postSystemMessage(
        tx,
        newGroup.id,
        SYSTEM_EVENTS.GROUP_CREATED,
        `🎉 ${dto.name} was created. Invite people to get started!`,
      );

      return newGroup;
    });

    this.logger.log(`Group created: id=${group.id} creator=${userId}`);
    return this.getGroupDetail(userId, group.id);
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async getMyGroups(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, status: { not: 'INACTIVE' } },
      include: { group: { include: { members: true } } },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => this.toGroupSummary(m.group, userId));
  }

  async getPublicGroups(dto: ListPublicGroupsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where = { visibility: 'PUBLIC' as const, status: 'PENDING' as const };

    const [total, groups] = await Promise.all([
      this.prisma.ajoGroup.count({ where }),
      this.prisma.ajoGroup.findMany({
        where,
        include: { members: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Groups that have already filled up aren't really "discoverable" anymore.
    const joinable = groups.filter(
      (g) => g.members.filter((m) => m.status === 'ACTIVE').length < g.cycleLength,
    );

    return {
      data: joinable.map((g) => this.toGroupSummary(g, null)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getGroupDetail(userId: string, groupId: string) {
    const group = await this.prisma.ajoGroup.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { payoutOrder: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');

    const myMembership = group.members.find((m) => m.userId === userId);

    if (group.visibility === 'PRIVATE' && !myMembership) {
      throw new ForbiddenException('This is a private group');
    }

    let myJoinRequestStatus: string | null = null;
    if (!myMembership) {
      const myRequest = await this.prisma.groupJoinRequest.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      myJoinRequestStatus = myRequest?.status ?? null;
    }

    return {
      ...this.toGroupSummary(group, userId),
      description: group.description,
      gracePeriodHours: group.gracePeriodHours,
      activationMode: group.activationMode,
      inviteCode: myMembership?.role === 'ADMIN' ? group.inviteCode : undefined,
      myRole: myMembership?.role ?? null,
      myJoinRequestStatus,
      members: group.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user.fullName,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        status: m.status,
        payoutOrder: m.payoutOrder,
        payoutRound: m.payoutRound,
        hasReceivedPayout: Boolean(m.payoutReceivedAt),
        joinedAt: m.joinedAt,
      })),
    };
  }

  // ─── Join: private groups (invite code) ────────────────────────────────────

  async joinByInviteCode(userId: string, inviteCode: string) {
    const group = await this.prisma.ajoGroup.findUnique({ where: { inviteCode } });
    if (!group) throw new NotFoundException('Invalid or expired invite link');

    if (group.visibility !== 'PRIVATE') {
      throw new BadRequestException(
        'This is a public group — use "request to join" instead',
      );
    }

    return this.addMember(group.id, userId);
  }

  // ─── Join: public groups (request + approval) ──────────────────────────────

  async requestToJoin(userId: string, groupId: string, dto: RequestToJoinDto) {
    const group = await this.prisma.ajoGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.visibility !== 'PUBLIC') {
      throw new BadRequestException('This group is not publicly joinable');
    }
    if (group.status !== 'PENDING') {
      throw new BadRequestException('This group is no longer accepting members');
    }
    if (group.members.some((m) => m.userId === userId && m.status === 'ACTIVE')) {
      throw new ConflictException('You are already a member of this group');
    }
    const activeCount = group.members.filter((m) => m.status === 'ACTIVE').length;
    if (activeCount >= group.cycleLength) {
      throw new BadRequestException('This group is already full');
    }

    const request = await this.prisma.groupJoinRequest.upsert({
      where: { groupId_userId: { groupId, userId } },
      create: { groupId, userId, message: dto.message },
      // Allow re-requesting after a prior rejection.
      update: { status: 'PENDING', message: dto.message, reviewedAt: null, reviewedByUserId: null },
    });

    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    const admins = group.members.filter((m) => m.role === 'ADMIN');
    await Promise.all(
      admins.map((admin) =>
        this.realtime
          .notify({
            userId: admin.userId,
            groupId,
            type: 'JOIN_REQUEST_RECEIVED',
            title: 'New join request',
            body: `${requester?.fullName ?? 'Someone'} wants to join ${group.name}`,
          })
          .catch((err) => this.logger.warn(`notify failed: ${err}`)),
      ),
    );

    return request;
  }

  async listJoinRequests(userId: string, groupId: string) {
    await this.assertAdmin(userId, groupId);
    return this.prisma.groupJoinRequest.findMany({
      where: { groupId, status: 'PENDING' },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, reputationScore: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewJoinRequest(
    userId: string,
    groupId: string,
    requestId: string,
    dto: ReviewJoinRequestDto,
  ) {
    await this.assertAdmin(userId, groupId);

    const request = await this.prisma.groupJoinRequest.findUnique({ where: { id: requestId } });
    if (!request || request.groupId !== groupId) {
      throw new NotFoundException('Join request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('This request has already been reviewed');
    }

    if (dto.decision === 'REJECT') {
      await this.prisma.groupJoinRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', reviewedByUserId: userId, reviewedAt: new Date() },
      });
      await this.realtime
        .notify({
          userId: request.userId,
          groupId,
          type: 'JOIN_REQUEST_REJECTED',
          title: 'Join request declined',
          body: 'Your request to join the group was not approved this time.',
        })
        .catch(() => undefined);
      return { status: 'REJECTED' };
    }

    // APPROVE
    await this.prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', reviewedByUserId: userId, reviewedAt: new Date() },
    });
    await this.addMember(groupId, request.userId);
    await this.realtime
      .notify({
        userId: request.userId,
        groupId,
        type: 'JOIN_REQUEST_APPROVED',
        title: 'Join request approved 🎉',
        body: "You're in! Welcome to the group.",
      })
      .catch(() => undefined);

    return { status: 'APPROVED' };
  }

  // ─── Admin: direct invite ───────────────────────────────────────────────────

  async inviteUser(userId: string, groupId: string, dto: InviteUserDto) {
    const group = await this.assertAdmin(userId, groupId);

    const targetWallet = await this.prisma.wallet.findUnique({
      where: { accountNumber: dto.accountNumber },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!targetWallet?.user) {
      throw new NotFoundException('No Ajo user found with that account number');
    }

    await this.realtime.notify({
      userId: targetWallet.user.id,
      groupId,
      type: 'INVITE_RECEIVED',
      title: `You're invited to ${group.name}`,
      body: `Use invite code ${group.inviteCode} to join.`,
      data: { inviteCode: group.inviteCode },
    });

    return { message: `Invite sent to ${targetWallet.user.fullName}` };
  }

  // ─── Leave (pending groups only — pre-activation) ───────────────────────────

  async leaveGroup(userId: string, groupId: string) {
    const group = await this.prisma.ajoGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Group not found');
    if (group.status !== 'PENDING') {
      throw new BadRequestException(
        'This group has already started — leaving an active group is handled separately',
      );
    }

    const membership = group.members.find((m) => m.userId === userId);
    if (!membership) throw new NotFoundException('You are not a member of this group');
    if (membership.role === 'ADMIN' && group.members.length > 1) {
      throw new BadRequestException(
        'Transfer admin to another member (or remove them) before leaving',
      );
    }

    const remaining = group.members
      .filter((m) => m.id !== membership.id)
      .sort((a, b) => a.payoutOrder - b.payoutOrder);

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { id: membership.id } });

      // Compact payoutOrder so it stays a contiguous 1..N sequence.
      for (let i = 0; i < remaining.length; i++) {
        const order = i + 1;
        if (remaining[i].payoutOrder !== order) {
          await tx.groupMember.update({
            where: { id: remaining[i].id },
            data: { payoutOrder: order, payoutRound: order },
          });
        }
      }

      if (remaining.length > 0) {
        await this.chat.postSystemMessage(
          tx,
          groupId,
          SYSTEM_EVENTS.MEMBER_LEFT,
          'A member left the group.',
        );
      }
    });

    return { message: 'You have left the group' };
  }

  // ─── Admin: remove a member / transfer admin (pending groups only) ─────────

  async removeMember(adminUserId: string, groupId: string, targetUserId: string) {
    const group = await this.assertAdmin(adminUserId, groupId);
    if (group.status !== 'PENDING') {
      throw new BadRequestException('Cannot remove members from an active group here');
    }
    if (targetUserId === adminUserId) {
      throw new BadRequestException('Use "leave group" to remove yourself');
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { payoutOrder: 'asc' },
    });
    const target = members.find((m) => m.userId === targetUserId);
    if (!target) throw new NotFoundException('Member not found');

    const remaining = members.filter((m) => m.id !== target.id);

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({ where: { id: target.id } });
      for (let i = 0; i < remaining.length; i++) {
        const order = i + 1;
        if (remaining[i].payoutOrder !== order) {
          await tx.groupMember.update({
            where: { id: remaining[i].id },
            data: { payoutOrder: order, payoutRound: order },
          });
        }
      }
      await this.chat.postSystemMessage(
        tx,
        groupId,
        SYSTEM_EVENTS.MEMBER_REMOVED,
        'A member was removed from the group.',
      );
    });

    await this.realtime
      .notify({
        userId: targetUserId,
        groupId,
        type: 'MEMBER_REMOVED',
        title: `Removed from ${group.name}`,
        body: 'The group admin removed you from this group.',
      })
      .catch(() => undefined);

    return { message: 'Member removed' };
  }

  async transferAdmin(adminUserId: string, groupId: string, newAdminUserId: string) {
    await this.assertAdmin(adminUserId, groupId);
    if (newAdminUserId === adminUserId) {
      throw new BadRequestException('You are already the admin');
    }

    const newAdminMembership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: newAdminUserId } },
    });
    if (!newAdminMembership || newAdminMembership.status !== 'ACTIVE') {
      throw new NotFoundException('That user is not an active member of this group');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: adminUserId } },
        data: { role: 'MEMBER' },
      });
      await tx.groupMember.update({
        where: { groupId_userId: { groupId, userId: newAdminUserId } },
        data: { role: 'ADMIN' },
      });
    });

    return { message: 'Admin role transferred' };
  }

  // ─── Activation ──────────────────────────────────────────────────────────

  async activate(userId: string, groupId: string) {
    const group = await this.assertAdmin(userId, groupId);

    if (group.status !== 'PENDING') {
      throw new BadRequestException('Group is not pending activation');
    }
    if (group.activationMode !== 'MANUAL_START_BY_ADMIN') {
      throw new BadRequestException('This group is set to auto-start when full');
    }

    const activeMembers = await this.prisma.groupMember.count({
      where: { groupId, status: 'ACTIVE' },
    });
    if (activeMembers < 2) {
      throw new BadRequestException('Need at least 2 members to start');
    }

    await this.performActivation(groupId);
    return this.getGroupDetail(userId, groupId);
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /** Adds a user as an ACTIVE member, links friendships, posts chat update, checks auto-activation. */
  private async addMember(groupId: string, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const group = await tx.ajoGroup.findUnique({ where: { id: groupId }, include: { members: true } });
      if (!group) throw new NotFoundException('Group not found');
      if (group.status !== 'PENDING') {
        throw new BadRequestException('This group is no longer accepting members');
      }
      if (group.members.some((m) => m.userId === userId && m.status === 'ACTIVE')) {
        throw new ConflictException('You are already a member of this group');
      }
      const activeCount = group.members.filter((m) => m.status === 'ACTIVE').length;
      if (activeCount >= group.cycleLength) {
        throw new BadRequestException('This group is already full');
      }

      const nextOrder = activeCount + 1;
      await tx.groupMember.create({
        data: { groupId, userId, payoutOrder: nextOrder, payoutRound: nextOrder },
      });

      await this.friends.linkNewMemberWithGroup(tx, groupId, userId);

      const newUser = await tx.user.findUnique({ where: { id: userId }, select: { fullName: true } });
      await this.chat.postSystemMessage(
        tx,
        groupId,
        SYSTEM_EVENTS.MEMBER_JOINED,
        `👋 ${newUser?.fullName ?? 'A new member'} joined the group.`,
      );

      return { group, willBeFull: nextOrder === group.cycleLength };
    });

    if (result.willBeFull && result.group.activationMode === 'AUTO_START_WHEN_FULL') {
      await this.performActivation(groupId);
    }

    return { message: 'Joined group successfully' };
  }

  /**
   * Locks the group, finalises payout order/amounts, generates the Round
   * schedule, and opens round 1's contributions. NOTE: this creates the
   * schedule shell only — actually charging wallets each round, tracking
   * LATE/DEFAULTED status, and releasing payouts is ContributionsModule /
   * PayoutsModule's job (not yet built).
   */
  private async performActivation(groupId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const group = await tx.ajoGroup.findUnique({ where: { id: groupId } });
      if (!group || group.status !== 'PENDING') return; // already activated (race-safe no-op)

      const members = await tx.groupMember.findMany({
        where: { groupId, status: 'ACTIVE' },
        orderBy: { payoutOrder: 'asc' },
      });

      const actualCount = members.length;
      const cycleLength = actualCount; // may be < original target on early manual start
      const contributionAmountKobo = group.memberShareKobo * actualCount;

      await tx.ajoGroup.update({
        where: { id: groupId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          currentRound: 1,
          cycleLength,
          contributionAmountKobo,
        },
      });

      const durationMs = frequencyDurationMs(group.frequency);
      let cursor = new Date();

      for (let roundNumber = 1; roundNumber <= cycleLength; roundNumber++) {
        const startDate = cursor;
        const endDate = new Date(cursor.getTime() + durationMs);
        cursor = endDate;

        const payoutMember = members[roundNumber - 1];

        const round = await tx.round.create({
          data: {
            groupId,
            roundNumber,
            status: roundNumber === 1 ? 'ACTIVE' : 'UPCOMING',
            payoutMemberId: payoutMember.id,
            startDate,
            endDate,
          },
        });

        if (roundNumber === 1) {
          await tx.contribution.createMany({
            data: members.map((m) => ({
              roundId: round.id,
              groupMemberId: m.id,
              amountKobo: group.memberShareKobo,
              dueDate: endDate,
            })),
          });
        }
      }

      const payoutMemberForRound1 = members[0];
      const payoutUser = await tx.user.findUnique({
        where: { id: payoutMemberForRound1.userId },
        select: { fullName: true },
      });

      await this.chat.postSystemMessage(
        tx,
        groupId,
        SYSTEM_EVENTS.GROUP_ACTIVATED,
        `🚀 Contribution period has started! Round 1 is underway — payout goes to ${payoutUser?.fullName ?? 'the first member'}.`,
      );
    });

    // Post-commit notifications — best-effort, not part of the atomic activation.
    const members = await this.prisma.groupMember.findMany({ where: { groupId, status: 'ACTIVE' } });
    const group = await this.prisma.ajoGroup.findUnique({ where: { id: groupId } });
    await Promise.all(
      members.map((m) =>
        this.realtime
          .notify({
            userId: m.userId,
            groupId,
            type: 'GROUP_STARTED',
            title: `${group?.name} has started!`,
            body: 'Round 1 has begun. Check the group for your contribution schedule.',
          })
          .catch((err) => this.logger.warn(`notify failed: ${err}`)),
      ),
    );

    this.logger.log(`Group activated: id=${groupId}`);
  }

  private async assertAdmin(userId: string, groupId: string) {
    const group = await this.prisma.ajoGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only a group admin can do this');
    }
    return group;
  }

  private async generateUniqueInviteCode(): Promise<string> {
    let code = generateInviteCode();
    while (await this.prisma.ajoGroup.findUnique({ where: { inviteCode: code } })) {
      code = generateInviteCode();
    }
    return code;
  }

  private toGroupSummary(
    group: {
      id: string;
      name: string;
      description?: string | null;
      memberShareKobo: number;
      contributionAmountKobo: number;
      cycleLength: number;
      frequency: string;
      visibility: string;
      status: string;
      currentRound: number;
      creatorId: string;
      inviteCode?: string | null;
      createdAt: Date;
      members: { userId: string; status: string; role: string; payoutOrder: number; payoutRound: number; payoutReceivedAt?: Date | null }[];
    },
    forUserId: string | null,
  ) {
    const activeMembers = group.members.filter((m) => m.status === 'ACTIVE');
    const myMembership = forUserId ? group.members.find((m) => m.userId === forUserId) : undefined;

    return {
      id: group.id,
      name: group.name,
      contributionAmountKobo: group.contributionAmountKobo,
      memberShareKobo: group.memberShareKobo,
      cycleLength: group.cycleLength,
      frequency: group.frequency,
      visibility: group.visibility,
      status: group.status,
      currentRound: group.currentRound,
      creatorId: group.creatorId,
      createdAt: group.createdAt,
      memberCount: activeMembers.length,
      slotsRemaining: Math.max(0, group.cycleLength - activeMembers.length),
      myRole: myMembership?.role ?? null,
      myStatus: myMembership?.status ?? null,
      myPayoutRound: myMembership?.payoutRound ?? null,
      myPayoutReceived: Boolean(myMembership?.payoutReceivedAt),
    };
  }
}
