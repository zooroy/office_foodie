import {
  Controller,
  Injectable,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { matchesCredential, hashCredential } from '../identity/credentials.js';
import { AdminGuard } from '../identity/guards.js';
import { PrismaService } from '../database/prisma.service.js';
import { GroupEvents } from '../realtime/group-events.js';
import { seedDemo } from './seed-data.js';
import type { Request } from 'express';
import { SimulationService } from './simulation.service.js';
@Injectable()
export class DemoEnabledGuard {
  canActivate() {
    assertDemo();
    return true;
  }
}
export function assertDemo() {
  if (process.env.DEMO_MODE !== 'true')
    throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到此功能' });
}
@Controller('demo')
export class DemoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GroupEvents,
    private readonly simulation: SimulationService,
  ) {}
  @Post('reset')
  async reset(@Req() request: Request) {
    assertDemo();
    const token = process.env.DEMO_RESET_TOKEN;
    if (
      !token ||
      !matchesCredential(
        request.get('X-Demo-Reset-Token') ?? '',
        hashCredential(token),
      )
    )
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '重置憑證無效',
      });
    this.simulation.cancelAll();
    await seedDemo(this.prisma);
    for (const slug of ['demo-lunch', 'demo-closed'])
      await this.events.publish('group.updated', slug);
    return { reset: true };
  }
  @Post('groups/:slug/simulate')
  @UseGuards(DemoEnabledGuard, AdminGuard)
  async simulate(@Param('slug') slug: string) {
    assertDemo();
    return this.simulation.start(slug);
  }
}
