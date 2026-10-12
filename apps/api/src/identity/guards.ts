import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Group, Participant } from '@prisma/client';
import { PrismaService } from '../database/prisma.service.js';
import { matchesCredential, hashCredential } from './credentials.js';

export interface IdentityRequest extends Request {
  isAdmin?: boolean;
  group: Group;
  participant?: Participant;
}

async function resolveGroup(
  prisma: PrismaService,
  request: Request,
): Promise<Group> {
  let group: Group | null = null;
  if (typeof request.params.slug === 'string') {
    group = await prisma.group.findUnique({
      where: { slug: request.params.slug },
    });
  } else if (typeof request.params.id === 'string') {
    const participant = request.path.startsWith('/orders/')
      ? (
          await prisma.orderItem.findUnique({
            where: { id: request.params.id },
            include: { participant: true },
          })
        )?.participant
      : await prisma.participant.findUnique({
          where: { id: request.params.id },
        });
    if (participant)
      group = await prisma.group.findUnique({
        where: { id: participant.groupId },
      });
  }
  if (!group)
    throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到揪團' });
  return group;
}

@Injectable()
export class ParticipantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const token = request.get('X-Participant-Token');
    if (!token)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '請先加入揪團',
      });
    request.group = await resolveGroup(this.prisma, request);
    const participant = await this.prisma.participant.findFirst({
      where: { groupId: request.group.id, tokenHash: hashCredential(token) },
    });
    if (!participant || !matchesCredential(token, participant.tokenHash)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '參與者憑證無效',
      });
    }
    request.participant = participant;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const secret = request.get('X-Admin-Secret');
    if (!secret)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: '需要主揪憑證',
      });
    request.group = await resolveGroup(this.prisma, request);
    if (!matchesCredential(secret, request.group.adminSecretHash)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '主揪憑證無效',
      });
    }
    return true;
  }
}

@Injectable()
export class OrderActorGuard implements CanActivate {
  constructor(
    private readonly admin: AdminGuard,
    private readonly participantGuard: ParticipantGuard,
  ) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    if (request.get('X-Admin-Secret')) {
      await this.admin.canActivate(context);
      request.isAdmin = true;
    } else {
      await this.participantGuard.canActivate(context);
      request.isAdmin = false;
    }
    return true;
  }
}
