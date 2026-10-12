import { Global, Module } from '@nestjs/common';
import { AdminGuard, ParticipantGuard } from './guards.js';
import { ParticipantController } from './participant.controller.js';

@Global()
@Module({
  controllers: [ParticipantController],
  providers: [AdminGuard, ParticipantGuard],
  exports: [AdminGuard, ParticipantGuard],
})
export class IdentityModule {}
