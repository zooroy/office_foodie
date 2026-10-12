import { Global, Module } from '@nestjs/common';
import { GroupService } from './group.service.js';
import { GroupController } from './group.controller.js';
@Global()
@Module({
  providers: [GroupService],
  controllers: [GroupController],
  exports: [GroupService],
})
export class GroupModule {}
