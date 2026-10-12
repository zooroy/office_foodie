import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  GroupInput,
  GroupSnapshot,
  GroupStatus,
} from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';
import { generateCredential, hashCredential } from '../identity/credentials.js';
import { publicParticipant } from '../identity/public-participant.js';
import { GroupEvents } from '../realtime/group-events.js';
import { transition } from './status.js';

export async function lockGroup(tx: Prisma.TransactionClient, slug: string) {
  await tx.$executeRaw`SELECT id FROM "Group" WHERE slug = ${slug} FOR UPDATE`;
  const group = await tx.group.findUnique({ where: { slug } });
  if (!group)
    throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到揪團' });
  return group;
}
export function assertMutable(status: GroupStatus) {
  if (status === 'SETTLED' || status === 'CANCELLED')
    throw new ConflictException({
      code: 'GROUP_FINALIZED',
      message: '已結案或取消，無法修改',
    });
}
@Injectable()
export class GroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GroupEvents,
  ) {}
  async create(input: GroupInput) {
    if (
      !(await this.prisma.restaurant.findUnique({
        where: { id: input.restaurantId },
      }))
    )
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到餐廳' });
    const adminSecret = generateCredential();
    const slug = randomBytes(10).toString('base64url').slice(0, 10);
    await this.prisma.group.create({
      data: { ...input, slug, adminSecretHash: hashCredential(adminSecret) },
    });
    return { slug, adminSecret };
  }
  async snapshot(slug: string): Promise<GroupSnapshot> {
    const group = await this.prisma.group.findUnique({
      where: { slug },
      include: {
        restaurant: {
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            },
          },
        },
        participants: {
          orderBy: { joinedAt: 'asc' },
          include: { orders: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    if (!group)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到揪團' });
    const r = group.restaurant;
    return {
      id: group.id,
      slug: group.slug,
      title: group.title,
      restaurantId: group.restaurantId,
      status: group.status,
      deadlineAt: group.deadlineAt?.toISOString() ?? null,
      note: group.note,
      isDemo: group.isDemo,
      createdAt: group.createdAt.toISOString(),
      restaurant: {
        id: r.id,
        name: r.name,
        phone: r.phone,
        address: r.address,
        createdAt: r.createdAt.toISOString(),
        items: r.items.map((item) => ({
          id: item.id,
          restaurantId: item.restaurantId,
          name: item.name,
          price: item.price,
          category: item.category,
          sortOrder: item.sortOrder,
        })),
      },
      participants: group.participants.map(publicParticipant),
    };
  }
  async list(status: GroupStatus) {
    const groups = await this.prisma.group.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      select: { slug: true },
    });
    return Promise.all(groups.map((group) => this.snapshot(group.slug)));
  }
  async transition(slug: string, to: GroupStatus) {
    await this.prisma.$transaction(async (tx) => {
      const group = await lockGroup(tx, slug);
      transition(group.status, to);
      if (
        to === 'OPEN' &&
        !(await tx.menuItem.count({
          where: { restaurantId: group.restaurantId, deletedAt: null },
        }))
      )
        throw new ConflictException({
          code: 'EMPTY_MENU',
          message: '請先建立至少一個菜單品項',
        });
      await tx.group.update({ where: { id: group.id }, data: { status: to } });
    });
    await this.events.publish('group.updated', slug);
    return this.snapshot(slug);
  }
  async update(slug: string, input: Partial<GroupInput>) {
    await this.prisma.$transaction(async (tx) => {
      const group = await lockGroup(tx, slug);
      assertMutable(group.status);
      if (input.restaurantId && input.restaurantId !== group.restaurantId) {
        if (group.status !== 'DRAFT')
          throw new ConflictException({
            code: 'RESTAURANT_LOCKED',
            message: '發布後不可更換餐廳',
          });
        if (
          !(await tx.restaurant.findUnique({
            where: { id: input.restaurantId },
          }))
        )
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: '找不到餐廳',
          });
      }
      await tx.group.update({ where: { id: group.id }, data: input });
    });
    await this.events.publish('group.updated', slug);
    return this.snapshot(slug);
  }
}
