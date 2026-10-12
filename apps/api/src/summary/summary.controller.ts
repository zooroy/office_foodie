import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  adjustmentInputSchema,
  paymentInputSchema,
} from '@office-foodie/shared';
import type { PaymentStatus } from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';
import {
  GroupService,
  assertMutable,
  lockGroup,
} from '../groups/group.service.js';
import { AdminGuard, OrderActorGuard } from '../identity/guards.js';
import type { IdentityRequest } from '../identity/guards.js';
import { publicParticipant } from '../identity/public-participant.js';
import { GroupEvents } from '../realtime/group-events.js';
import { amountDue, calculateSummary } from './calculate.js';
class AdjustmentDto {
  static schema = adjustmentInputSchema;
  adjustment!: number;
}
class PaymentDto {
  static schema = paymentInputSchema;
  paymentStatus!: PaymentStatus;
}
@Controller()
export class SummaryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupService,
    private readonly events: GroupEvents,
  ) {}
  @Get('groups/:slug/summary')
  async summary(@Param('slug') slug: string) {
    return calculateSummary((await this.groups.snapshot(slug)).participants);
  }
  @Patch('participants/:id/adjustment')
  @UseGuards(AdminGuard)
  async adjustment(
    @Param('id') id: string,
    @Body() body: AdjustmentDto,
    @Req() request: IdentityRequest,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const group = await lockGroup(tx, request.group.slug);
      assertMutable(group.status);
      const person = await tx.participant.findUniqueOrThrow({
        where: { id },
        include: { orders: true },
      });
      amountDue(
        person.orders.reduce(
          (sum, order) => sum + order.quantity * order.unitPriceSnapshot,
          0,
        ),
        body.adjustment,
      );
      return tx.participant.update({
        where: { id },
        data: body,
        include: { orders: true },
      });
    });
    await this.events.publish('payment.updated', request.group.slug);
    return publicParticipant(result);
  }
  @Patch('participants/:id/payment')
  @UseGuards(OrderActorGuard)
  async payment(
    @Param('id') id: string,
    @Body() body: PaymentDto,
    @Req() request: IdentityRequest,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const group = await lockGroup(tx, request.group.slug);
      if (group.status !== 'CLOSED' && group.status !== 'ORDERED')
        throw new ConflictException({
          code: 'PAYMENT_NOT_AVAILABLE',
          message: '結單或已訂購時才能變更付款狀態',
        });
      const person = await tx.participant.findUniqueOrThrow({ where: { id } });
      if (
        !request.isAdmin &&
        (id !== request.participant?.id ||
          body.paymentStatus === 'CONFIRMED' ||
          person.paymentStatus === 'CONFIRMED')
      )
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: '只能回報或撤回自己的未確認付款',
        });
      return tx.participant.update({
        where: { id },
        data: body,
        include: { orders: true },
      });
    });
    await this.events.publish('payment.updated', request.group.slug);
    return publicParticipant(result);
  }
}
