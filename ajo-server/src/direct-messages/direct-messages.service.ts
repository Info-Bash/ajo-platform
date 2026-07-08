import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { GetDirectMessagesDto } from './dto/direct-messages.dto';

@Injectable()
export class DirectMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  // ─── Conversations ──────────────────────────────────────────────────────────

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, fullName: true, avatarUrl: true } },
        userB: { select: { id: true, fullName: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const results = await Promise.all(
      conversations.map(async (c) => {
        const otherUser = c.userAId === userId ? c.userB : c.userA;
        const unreadCount = await this.prisma.directMessage.count({
          where: { conversationId: c.id, senderId: { not: userId }, readAt: null },
        });
        return {
          conversationId: c.id,
          otherUser,
          lastMessage: c.messages[0]?.content ?? null,
          lastMessageAt: c.lastMessageAt,
          unreadCount,
        };
      }),
    );

    return results;
  }

  // ─── Messages (addressed by the other user's id — conversationId is an
  //     internal implementation detail the client never needs to know) ───────

  async listMessages(userId: string, otherUserId: string, dto: GetDirectMessagesDto) {
    const conversation = await this.findConversation(userId, otherUserId);
    if (!conversation) return { data: [], meta: { total: 0, page: 1, limit: dto.limit ?? 30, totalPages: 0 } };

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 30;

    const [total, messages] = await Promise.all([
      this.prisma.directMessage.count({ where: { conversationId: conversation.id } }),
      this.prisma.directMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Mark the other person's messages as read now that we've fetched them.
    await this.prisma.directMessage.updateMany({
      where: { conversationId: conversation.id, senderId: otherUserId, readAt: null },
      data: { readAt: new Date() },
    });

    return {
      data: messages.reverse(),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async sendMessage(userId: string, otherUserId: string, content: string) {
    if (userId === otherUserId) {
      throw new BadRequestException('You cannot message yourself');
    }

    const conversation = await this.getOrCreateConversation(userId, otherUserId);

    const sender = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, avatarUrl: true },
    });

    const [message] = await this.prisma.$transaction([
      this.prisma.directMessage.create({
        data: { conversationId: conversation.id, senderId: userId, content },
      }),
      this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    const payload = {
      id: message.id,
      conversationId: conversation.id,
      senderId: userId,
      senderName: sender?.fullName,
      senderAvatarUrl: sender?.avatarUrl,
      content,
      createdAt: message.createdAt,
    };

    this.realtime.emitToUser(otherUserId, REALTIME_EVENTS.DIRECT_MESSAGE, payload);
    this.realtime.emitToUser(userId, REALTIME_EVENTS.DIRECT_MESSAGE, payload); // sender's other open tabs/devices

    await this.realtime
      .notify({
        userId: otherUserId,
        type: 'DIRECT_MESSAGE_RECEIVED',
        title: sender?.fullName ?? 'New message',
        body: content.length > 80 ? `${content.slice(0, 80)}…` : content,
        data: { conversationId: conversation.id, senderId: userId },
      })
      .catch(() => undefined);

    return payload;
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  /** Pair is always stored userAId < userBId so it can never get two rows. */
  private normalizePair(userId: string, otherUserId: string): [string, string] {
    return userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
  }

  private async findConversation(userId: string, otherUserId: string) {
    const [userAId, userBId] = this.normalizePair(userId, otherUserId);
    return this.prisma.conversation.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
  }

  private async getOrCreateConversation(userId: string, otherUserId: string) {
    const existing = await this.findConversation(userId, otherUserId);
    if (existing) return existing;

    // New conversations are only allowed between friends — this app auto-
    // friends group co-members specifically so people have a real connection
    // before DMing. (Easy to relax later if open DMs are wanted instead.)
    const areFriends = await this.checkFriendship(userId, otherUserId);
    if (!areFriends) {
      const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId } });
      if (!otherUser) throw new NotFoundException('User not found');
      throw new ForbiddenException(
        'You can only message people you share an Ajo group with. Join a group together first!',
      );
    }

    const [userAId, userBId] = this.normalizePair(userId, otherUserId);
    return this.prisma.conversation.create({ data: { userAId, userBId } });
  }

  private async checkFriendship(userId: string, otherUserId: string): Promise<boolean> {
    const [initiatorId, receiverId] = this.normalizePair(userId, otherUserId);
    const friendship = await this.prisma.friendship.findUnique({
      where: { initiatorId_receiverId: { initiatorId, receiverId } },
    });
    return friendship?.status === 'ACCEPTED';
  }
}
