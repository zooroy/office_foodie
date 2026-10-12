import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Participant, OrderItem } from '@prisma/client';
import { participantInputSchema } from '@office-foodie/shared';
import type {
  ParticipantDto,
  ParticipantJoinedDto,
} from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';
import {
  generateCredential,
  hashCredential,
  normalizeNickname,
} from './credentials.js';
import { ParticipantGuard } from './guards.js';
import type { IdentityRequest } from './guards.js';

class JoinParticipantDto {
  static schema = participantInputSchema;
  nickname!: string;
}
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

@Controller('groups/:slug')
export class ParticipantController {
  constructor(private readonly prisma: PrismaService) {}
  @Post('participants')
  async join(
    @Param('slug') slug: string,
    @Body() body: JoinParticipantDto,
  ): Promise<ParticipantJoinedDto> {
    const group = await this.prisma.group.findUnique({ where: { slug } });
    if (!group)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到揪團' });
    const participantToken = generateCredential();
    try {
      const participant = await this.prisma.participant.create({
        data: {
          groupId: group.id,
          ...normalizeNickname(body.nickname),
          tokenHash: hashCredential(participantToken),
        },
        include: { orders: true },
      });
      return { participantToken, participant: publicParticipant(participant) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'NICKNAME_TAKEN',
          message: '暱稱已有人使用，請換一個暱稱',
        });
      }
      throw error;
    }
  }
  @Get('me')
  @UseGuards(ParticipantGuard)
  async me(@Req() request: IdentityRequest): Promise<ParticipantDto> {
    const participant = await this.prisma.participant.findUniqueOrThrow({
      where: { id: request.participant!.id },
      include: { orders: { orderBy: { createdAt: 'asc' } } },
    });
    return publicParticipant(participant);
  }
}
