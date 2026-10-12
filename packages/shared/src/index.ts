import { z } from 'zod';

export const groupStatusSchema = z.enum([
  'DRAFT',
  'OPEN',
  'CLOSED',
  'ORDERED',
  'SETTLED',
  'CANCELLED',
]);
export const paymentStatusSchema = z.enum(['UNPAID', 'REPORTED', 'CONFIRMED']);
export const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INTERNAL_ERROR',
  'REQUEST_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'GROUP_CLOSED',
  'GROUP_FINALIZED',
  'INVALID_TRANSITION',
  'EMPTY_MENU',
  'RESTAURANT_LOCKED',
  'NICKNAME_TAKEN',
  'EXTRACTION_FAILED',
  'EXTRACTION_LIMIT',
  'INVALID_IMAGE',
  'NEGATIVE_AMOUNT',
  'PAYMENT_NOT_AVAILABLE',
  'SIMULATION_RUNNING',
]);
export const apiErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
});
const requiredText = z.string().trim().min(1);
const id = requiredText;
const nullableText = z.string().trim().nullable().optional();
export const moneySchema = z.number().int().min(0).max(2147483647);
export const nicknameSchema = z.string().trim().min(1).max(20);
export const restaurantInputSchema = z.object({
  name: requiredText,
  phone: nullableText,
  address: nullableText,
});
export const restaurantUpdateSchema = restaurantInputSchema.partial();
export const menuItemInputSchema = z.object({
  name: requiredText,
  price: moneySchema,
  category: nullableText,
  sortOrder: z.number().int().min(0).max(2147483647).optional(),
});
export const menuItemUpdateSchema = menuItemInputSchema.partial();
export const menuBatchInputSchema = z.object({
  items: z.array(menuItemInputSchema),
});
export const groupInputSchema = z.object({
  title: requiredText,
  restaurantId: id,
  deadlineAt: z.iso.datetime({ offset: true }).nullable().optional(),
  note: nullableText,
});
export const groupUpdateSchema = groupInputSchema.partial();
export const transitionInputSchema = z.object({ to: groupStatusSchema });
export const participantInputSchema = z.object({ nickname: nicknameSchema });
export const orderInputSchema = z.object({
  menuItemId: id,
  participantId: id.optional(),
  quantity: z.number().int().min(1).max(99),
  note: z.string().max(100).nullable().optional(),
});
export const orderUpdateSchema = orderInputSchema
  .pick({ quantity: true, note: true })
  .partial();
export const paymentInputSchema = z.object({
  paymentStatus: paymentStatusSchema,
});
export const adjustmentInputSchema = z.object({
  adjustment: z.number().int().min(-2147483648).max(2147483647),
});
export const extractedItemSchema = z.object({
  name: requiredText,
  price: moneySchema.nullable(),
  category: nullableText,
  needsReview: z.boolean(),
});
export const extractionResultSchema = z.object({
  items: z.array(extractedItemSchema),
});

export type GroupStatus = z.infer<typeof groupStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type RestaurantInput = z.infer<typeof restaurantInputSchema>;
export type MenuItemInput = z.infer<typeof menuItemInputSchema>;
export type GroupInput = z.infer<typeof groupInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type PaymentInput = z.infer<typeof paymentInputSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentInputSchema>;
export type ExtractedItem = z.infer<typeof extractedItemSchema>;

export interface RestaurantDto {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  createdAt: string;
}
export interface MenuItemDto {
  id: string;
  restaurantId: string;
  name: string;
  price: number;
  category: string | null;
  sortOrder: number;
}
export interface OrderItemDto {
  id: string;
  participantId: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  note: string | null;
  createdAt: string;
}
export interface ParticipantDto {
  id: string;
  nickname: string;
  joinedAt: string;
  adjustment: number;
  paymentStatus: PaymentStatus;
  orders: OrderItemDto[];
}
export interface GroupSnapshot {
  id: string;
  slug: string;
  title: string;
  restaurantId: string;
  status: GroupStatus;
  deadlineAt: string | null;
  note: string | null;
  isDemo: boolean;
  createdAt: string;
  restaurant: RestaurantDto & { items: MenuItemDto[] };
  participants: ParticipantDto[];
}
export interface GroupCreatedDto {
  slug: string;
  adminSecret: string;
}
export interface ParticipantJoinedDto {
  participantToken: string;
  participant: ParticipantDto;
}
export interface SummaryItemDto {
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes: string[];
}
export interface SummaryParticipantDto {
  participantId: string;
  nickname: string;
  orders: OrderItemDto[];
  subtotal: number;
  adjustment: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
}
export interface GroupSummaryDto {
  items: SummaryItemDto[];
  participants: SummaryParticipantDto[];
  itemTotal: number;
  totalDue: number;
  totalPaid: number;
  totalUnpaid: number;
}
export const GROUP_EVENTS = {
  participantJoined: 'participant.joined',
  orderChanged: 'order.changed',
  groupUpdated: 'group.updated',
  paymentUpdated: 'payment.updated',
} as const;
export type GroupEventName = (typeof GROUP_EVENTS)[keyof typeof GROUP_EVENTS];
export type GroupEventPayload = GroupSnapshot;
export type ServerToClientEvents = {
  [K in GroupEventName]: (snapshot: GroupEventPayload) => void;
};
export interface ClientToServerEvents {
  join: (
    payload: { slug: string },
    acknowledge: (snapshot: GroupSnapshot | ApiError) => void,
  ) => void;
}
