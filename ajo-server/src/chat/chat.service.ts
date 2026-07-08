import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { SystemEventType } from './system-events.const';
import { GetMessagesDto } from './dto/chat.dto';

type PrismaTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * Posts an automatic system update to a group's chat (spec: "the system
   * should be able to post automatic updates ... new member joined, payment
   * reminder, payout has been made", etc). Called by GroupsService and
   * (later) ContributionsModule/PayoutsModule at the relevant lifecycle points.
   *
   * Accepts a transaction client so callers can post the message atomically
   * alongside the DB change that triggered it (e.g. a new GroupMember row).
   */
  async postSystemMessage(
    tx: PrismaTx,
    groupId: string,
    eventType: SystemEventType,
    content: string,
  ) {
    const message = await tx.chatMessage.create({
      data: { groupId, type: 'SYSTEM', systemEventType: eventType, content },
    });

    this.realtime.emitToGroup(groupId, REALTIME_EVENTS.CHAT_SYSTEM_MESSAGE, {
      id: message.id,
      groupId,
      type: 'SYSTEM',
      systemEventType: eventType,
      content,
      createdAt: message.createdAt,
    });

    return message;
  }

  async sendMessage(userId: string, groupId: string, content: string) {
    await this.assertMembership(userId, groupId);

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, avatarUrl: true },
    });

    const message = await this.prisma.chatMessage.create({
      data: { groupId, senderId: userId, type: 'USER', content },
    });

    const payload = {
      id: message.id,
      groupId,
      senderId: userId,
      senderName: sender?.fullName,
      senderAvatarUrl: sender?.avatarUrl,
      type: 'USER',
      content,
      createdAt: message.createdAt,
    };

    this.realtime.emitToGroup(groupId, REALTIME_EVENTS.CHAT_MESSAGE, payload);

    return payload;
  }

  async listMessages(userId: string, groupId: string, dto: GetMessagesDto) {
    await this.assertMembership(userId, groupId);

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 30;

    const [total, messages] = await Promise.all([
      this.prisma.chatMessage.count({ where: { groupId } }),
      this.prisma.chatMessage.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
      }),
    ]);

    return {
      data: messages
        .map((m) => ({
          id: m.id,
          groupId: m.groupId,
          senderId: m.senderId,
          senderName: m.sender?.fullName,
          senderAvatarUrl: m.sender?.avatarUrl,
          type: m.type,
          systemEventType: m.systemEventType,
          content: m.content,
          createdAt: m.createdAt,
        }))
        .reverse(), // oldest-first within the page, for natural chat rendering
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
      },
    };
  }

  private async assertMembership(userId: string, groupId: string): Promise<void> {
    const group = await this.prisma.ajoGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!membership || membership.status === 'EXITED' || membership.status === 'INACTIVE') {
      throw new ForbiddenException('You are not a member of this group');
    }
  }
}
