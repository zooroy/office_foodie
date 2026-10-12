import type { Participant, OrderItem } from '@prisma/client';
import type { ParticipantDto } from '@office-foodie/shared';
export function publicParticipant(
  participant: Participant & { orders: OrderItem[] },
): ParticipantDto {
  return {
    id: participant.id,
    nickname: participant.nickname,
    joinedAt: participant.joinedAt.toISOString(),
    adjustment: participant.adjustment,
    paymentStatus: participant.paymentStatus,
    orders: participant.orders.map((order) => ({
      id: order.id,
      participantId: order.participantId,
      menuItemId: order.menuItemId,
      nameSnapshot: order.nameSnapshot,
      unitPriceSnapshot: order.unitPriceSnapshot,
      quantity: order.quantity,
      note: order.note,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}
