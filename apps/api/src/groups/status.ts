import { ConflictException } from '@nestjs/common';
import type { GroupStatus } from '@office-foodie/shared';
export const TRANSITIONS: Record<GroupStatus, readonly GroupStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['SETTLED'],
  SETTLED: [],
  CANCELLED: [],
};
export function transition(from: GroupStatus, to: GroupStatus): GroupStatus {
  if (!TRANSITIONS[from].includes(to))
    throw new ConflictException({
      code: 'INVALID_TRANSITION',
      message: '不允許此揪團狀態變更',
    });
  return to;
}
