import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/app.config';
import type { JwtPayload } from '../auth/jwt.strategy';

/**
 * Every authenticated user is joined to a private room `user:<id>`.
 * All server → client pushes go through that room (see RealtimeService),
 * never a broadcast, so one user can never see another's events.
 *
 * Group rooms (`group:<id>`) are joined on demand — the client emits
 * `group:join` with the group id, and the gateway verifies membership
 * before joining (see handleJoinGroup below).
 */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function groupRoom(groupId: string): string {
  return `group:${groupId}`;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://ajo-app-eta.vercel.app',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  afterInit(): void {
    this.logger.log('Realtime gateway initialised');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const userId = await this.authenticate(client);
      client.data.userId = userId;
      await client.join(userRoom(userId));
      this.logger.log(`Socket connected: userId=${userId} socketId=${client.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unauthorized';
      this.logger.warn(`Socket rejected: ${message} socketId=${client.id}`);
      client.emit('connect_error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      this.logger.log(`Socket disconnected: userId=${userId} socketId=${client.id}`);
    }
  }

  // ─── Group rooms ────────────────────────────────────────────────────────
  // Client calls this once it opens a group's chat screen, so it starts
  // receiving that group's CHAT_MESSAGE/CHAT_SYSTEM_MESSAGE/MEMBER_* events.

  @SubscribeMessage('group:join')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ): Promise<void> {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !data?.groupId) return;

    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId } },
    });
    if (!membership || membership.status === 'EXITED' || membership.status === 'INACTIVE') {
      client.emit('group:join_error', { groupId: data.groupId, message: 'Not a member of this group' });
      return;
    }

    await client.join(groupRoom(data.groupId));
  }

  @SubscribeMessage('group:leave')
  handleLeaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ): void {
    if (data?.groupId) void client.leave(groupRoom(data.groupId));
  }

  // ─── Auth ───────────────────────────────────────────────────────────────
  // Reuses the same JWT the REST API issues (see auth/jwt.strategy.ts).
  // The client sends it via `socket.auth.token` — see client/src/lib/socket-client.ts.

  private async authenticate(client: Socket): Promise<string> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers?.authorization?.toString().replace(/^Bearer\s+/i, ''));

    if (!token) throw new Error('Missing auth token');

    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get('jwtSecret', { infer: true }),
      });
    } catch {
      throw new Error('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new Error('User no longer active');
    }

    return user.id;
  }
}
