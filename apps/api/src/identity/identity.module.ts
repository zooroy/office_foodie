import { Global, Module } from '@nestjs/common';
import { AdminGuard, ParticipantGuard, OrderActorGuard } from './guards.js';
import { ParticipantController } from './participant.controller.js';

@Global()
@Module({
  controllers: [ParticipantController],
  providers: [AdminGuard, ParticipantGuard, OrderActorGuard],
  exports: [AdminGuard, ParticipantGuard, OrderActorGuard],
})
export class IdentityModule {}
