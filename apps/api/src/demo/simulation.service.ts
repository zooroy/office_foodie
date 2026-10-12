import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { OrderService } from '../orders/order.controller.js';
import { GroupEvents } from '../realtime/group-events.js';
import { generateCredential, hashCredential } from '../identity/credentials.js';
import type { IdentityRequest } from '../identity/guards.js';
@Injectable()
export class SimulationService {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
    private readonly events: GroupEvents,
  ) {}
  async start(slug: string) {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { slug },
    });
    if (group.status !== 'OPEN')
      throw new ConflictException({
        code: 'GROUP_CLOSED',
        message: '只能在開放狀態模擬下單',
      });
    if (this.timers.has(slug))
      throw new ConflictException({
        code: 'SIMULATION_RUNNING',
        message: '此揪團已有模擬正在進行',
      });
    const schedule = (remaining: number) => {
      const timer = setTimeout(
        () => {
          void run(remaining);
        },
        2000 + Math.floor(Math.random() * 2001),
      );
      this.timers.set(slug, timer);
    };
    const run = async (remaining: number) => {
      try {
        const current = await this.prisma.group.findUniqueOrThrow({
          where: { slug },
        });
        if (current.status !== 'OPEN') {
          this.timers.delete(slug);
          return;
        }
        const items = await this.prisma.menuItem.findMany({
          where: { restaurantId: current.restaurantId, deletedAt: null },
        });
        const item = items[Math.floor(Math.random() * items.length)];
        if (!item) {
          this.timers.delete(slug);
          return;
        }
        const suffix = generateCredential().slice(0, 6);
        const person = await this.prisma.participant.create({
          data: {
            groupId: current.id,
            nickname: `模擬同事 ${suffix}`,
            nicknameKey: `模擬同事 ${suffix.toLowerCase()}`,
            tokenHash: hashCredential(generateCredential()),
          },
        });
        await this.events.publish('participant.joined', slug);
        await this.orders.create({ menuItemId: item.id, quantity: 1 }, {
          group: current,
          participant: person,
          isAdmin: false,
        } as IdentityRequest);
        if (remaining > 1) schedule(remaining - 1);
        else this.timers.delete(slug);
      } catch {
        this.timers.delete(slug);
      }
    };
    schedule(5);
    return { started: true };
  }
  cancelAll() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
  onModuleDestroy() {
    this.cancelAll();
  }
}
