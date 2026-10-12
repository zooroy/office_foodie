import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { orderInputSchema, orderUpdateSchema } from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';
import { OrderActorGuard } from '../identity/guards.js';
import type { IdentityRequest } from '../identity/guards.js';
import { GroupEvents } from '../realtime/group-events.js';
import { assertMutable, lockGroup } from '../groups/group.service.js';
class OrderDto {
  static schema = orderInputSchema;
  menuItemId!: string;
  participantId?: string;
  quantity!: number;
  note?: string | null;
}
class UpdateOrderDto {
  static schema = orderUpdateSchema;
  quantity?: number;
  note?: string | null;
}
async function ensureAmount(
  tx: Prisma.TransactionClient,
  participantId: string,
  excludedId: string | undefined,
  addition: number,
) {
  const participant = await tx.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: { orders: true },
  });
  const subtotal = participant.orders
    .filter((o) => o.id !== excludedId)
    .reduce((sum, o) => sum + o.quantity * o.unitPriceSnapshot, addition);
  if (subtotal + participant.adjustment < 0)
    throw new ConflictException({
      code: 'NEGATIVE_AMOUNT',
      message: '這次變更會使應付金額小於 0，請主揪先調整折扣',
    });
}
@Controller()
@UseGuards(OrderActorGuard)
export class OrderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GroupEvents,
  ) {}
  private async lock(tx: Prisma.TransactionClient, request: IdentityRequest) {
    const group = await lockGroup(tx, request.group.slug);
    assertMutable(group.status);
    if (!request.isAdmin && group.status !== 'OPEN')
      throw new ConflictException({
        code: 'GROUP_CLOSED',
        message: '目前未開放點餐，只有主揪可修改',
      });
    return group;
  }
  @Post('groups/:slug/orders')
  async create(@Body() body: OrderDto, @Req() request: IdentityRequest) {
    const result = await this.prisma.$transaction(async (tx) => {
      const group = await this.lock(tx, request);
      const participantId = request.isAdmin
        ? body.participantId
        : request.participant?.id;
      if (!participantId)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: '請選擇參與者',
        });
      if (
        !request.isAdmin &&
        body.participantId &&
        body.participantId !== participantId
      )
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '只能修改自己的點餐',
        });
      const participant = await tx.participant.findFirst({
        where: { id: participantId, groupId: group.id },
      });
      const item = await tx.menuItem.findFirst({
        where: {
          id: body.menuItemId,
          restaurantId: group.restaurantId,
          deletedAt: null,
        },
      });
      if (!participant || !item)
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: '找不到參與者或菜單品項',
        });
      await ensureAmount(
        tx,
        participantId,
        undefined,
        item.price * body.quantity,
      );
      return tx.orderItem.create({
        data: {
          participantId,
          menuItemId: item.id,
          nameSnapshot: item.name,
          unitPriceSnapshot: item.price,
          quantity: body.quantity,
          note: body.note,
        },
      });
    });
    await this.events.publish('order.changed', request.group.slug);
    return result;
  }
  private async existing(
    tx: Prisma.TransactionClient,
    id: string,
    request: IdentityRequest,
  ) {
    const group = await this.lock(tx, request);
    const order = await tx.orderItem.findUnique({
      where: { id },
      include: { participant: true },
    });
    if (!order || order.participant.groupId !== group.id)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到點餐' });
    if (!request.isAdmin && order.participantId !== request.participant?.id)
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '只能修改自己的點餐',
      });
    return order;
  }
  @Patch('orders/:id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateOrderDto,
    @Req() request: IdentityRequest,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await this.existing(tx, id, request);
      await ensureAmount(
        tx,
        order.participantId,
        id,
        order.unitPriceSnapshot * (body.quantity ?? order.quantity),
      );
      return tx.orderItem.update({ where: { id }, data: body });
    });
    await this.events.publish('order.changed', request.group.slug);
    return result;
  }
  @Delete('orders/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() request: IdentityRequest) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.existing(tx, id, request);
      await ensureAmount(tx, order.participantId, id, 0);
      await tx.orderItem.delete({ where: { id } });
    });
    await this.events.publish('order.changed', request.group.slug);
  }
}
