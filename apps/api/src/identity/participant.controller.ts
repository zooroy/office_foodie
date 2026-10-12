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
import { publicParticipant } from './public-participant.js';
import { GroupEvents } from '../realtime/group-events.js';
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
@Controller('groups/:slug')
export class ParticipantController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GroupEvents,
  ) {}
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
      await this.events.publish('participant.joined', slug);
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
