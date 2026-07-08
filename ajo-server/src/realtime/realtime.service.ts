import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway, userRoom, groupRoom } from './realtime.gateway';
import { REALTIME_EVENTS } from './realtime.events';

// Kept loose (string) rather than importing the Prisma enum so this module
// has zero compile-time coupling to generated Prisma client shape drift.
export interface NotifyInput {
  userId: string;
  groupId?: string;
  type: string; // NotificationType
  title: string;
  body: string;
  /** Extra payload merged into the socket event only (not persisted). */
  data?: Record<string, unknown>;
}

/**
 * Thin facade other services use to push real-time events, so
 * WalletService/WebhooksService/etc. never touch socket.io directly.
 *
 * Usage:
 *   constructor(private readonly realtime: RealtimeService) {}
 *   this.realtime.emitToUser(userId, REALTIME_EVENTS.WALLET_FUNDED, { amountKobo })
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly prisma: PrismaService,
  ) {}

  /** Push a raw event to every socket a user has open, on any device/tab. */
  emitToUser(userId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(userRoom(userId)).emit(event, payload);
  }

  /** Pushes an event to everyone currently connected to a group's chat room. */
  emitToGroup(groupId: string, event: string, payload: unknown): void {
    this.gateway.server?.to(groupRoom(groupId)).emit(event, payload);
  }

  /**
   * Persists a Notification row (so it shows up in notification history
   * once NotificationsModule exists) and pushes it live in the same call,
   * so callers don't have to do both separately.
   */
  async notify(input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        groupId: input.groupId,
        type: input.type as never, // cast: NotificationType enum
        title: input.title,
        body: input.body,
      },
    });

    this.emitToUser(input.userId, REALTIME_EVENTS.NOTIFICATION, {
      ...notification,
      ...input.data,
    });

    return notification;
  }
}
