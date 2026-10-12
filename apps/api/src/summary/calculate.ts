import { ConflictException } from '@nestjs/common';
import type {
  GroupSummaryDto,
  ParticipantDto,
  SummaryItemDto,
} from '@office-foodie/shared';
export function amountDue(subtotal: number, adjustment: number) {
  const amount = subtotal + adjustment;
  if (amount < 0)
    throw new ConflictException({
      code: 'NEGATIVE_AMOUNT',
      message: '應付金額不可小於 0',
    });
  return amount;
}
export function calculateSummary(people: ParticipantDto[]): GroupSummaryDto {
  const merged = new Map<string, SummaryItemDto>();
  const participants = people
    .filter((person) => person.orders.length > 0)
    .map((person) => {
      let subtotal = 0;
      for (const order of person.orders) {
        const price = order.unitPriceSnapshot * order.quantity;
        subtotal += price;
        const key = JSON.stringify([
          order.nameSnapshot,
          order.unitPriceSnapshot,
        ]);
        const item = merged.get(key) ?? {
          name: order.nameSnapshot,
          unitPrice: order.unitPriceSnapshot,
          quantity: 0,
          subtotal: 0,
          notes: [],
        };
        item.quantity += order.quantity;
        item.subtotal += price;
        if (order.note) item.notes.push(order.note);
        merged.set(key, item);
      }
      return {
        participantId: person.id,
        nickname: person.nickname,
        orders: person.orders,
        subtotal,
        adjustment: person.adjustment,
        amountDue: amountDue(subtotal, person.adjustment),
        paymentStatus: person.paymentStatus,
      };
    });
  const totalDue = participants.reduce(
    (sum, person) => sum + person.amountDue,
    0,
  );
  const totalPaid = participants
    .filter((person) => person.paymentStatus === 'CONFIRMED')
    .reduce((sum, person) => sum + person.amountDue, 0);
  const items = [...merged.values()];
  return {
    items,
    participants,
    itemTotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    totalDue,
    totalPaid,
    totalUnpaid: totalDue - totalPaid,
  };
}
