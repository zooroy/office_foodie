import { Module } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Socket, Server } from 'socket.io';
import { GroupEvents, GroupEventsModule } from './group-events.js';
import { z } from 'zod';
import { GroupModule } from '../groups/group.module.js';
import { GroupService } from '../groups/group.service.js';

const allowedOrigin = () => process.env.CORS_ORIGIN ?? 'http://localhost:3000';
@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, origin === allowedOrigin()),
  },
  allowRequest: (
    request: { headers: { origin?: string } },
    callback: (error: string | null, allow: boolean) => void,
  ) => callback(null, request.headers.origin === allowedOrigin()),
})
export class GroupGateway {
  @WebSocketServer() server!: Server;
  private unsubscribe?: () => void;
  constructor(
    private readonly groups: GroupService,
    private readonly events: GroupEvents,
  ) {}
  onModuleInit() {
    this.unsubscribe = this.events.subscribe(async (event, slug) => {
      const snapshot = await this.groups.snapshot(slug);
      this.server.to(`group:${slug}`).emit(event, snapshot);
    });
  }
  onModuleDestroy() {
    this.unsubscribe?.();
  }
  @SubscribeMessage('join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown) {
    const parsed = z
      .object({ slug: z.string().min(1).max(100) })
      .safeParse(body);
    if (!parsed.success)
      return { code: 'VALIDATION_ERROR', message: '請提供揪團代碼' };
    try {
      for (const room of socket.rooms)
        if (room.startsWith('group:')) await socket.leave(room);
      await socket.join(`group:${parsed.data.slug}`);
      return await this.groups.snapshot(parsed.data.slug);
    } catch {
      await socket.leave(`group:${parsed.data.slug}`);
      return { code: 'NOT_FOUND', message: '找不到揪團' };
    }
  }
}
@Module({
  imports: [GroupModule, GroupEventsModule],
  providers: [GroupGateway],
})
export class RealtimeModule {}
