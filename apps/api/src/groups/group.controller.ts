import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  groupInputSchema,
  groupUpdateSchema,
  groupStatusSchema,
  transitionInputSchema,
} from '@office-foodie/shared';
import type { GroupInput, GroupStatus } from '@office-foodie/shared';
import { AdminGuard } from '../identity/guards.js';
import { GroupService } from './group.service.js';
class CreateGroupDto {
  static schema = groupInputSchema;
  title!: string;
  restaurantId!: string;
  deadlineAt?: string | null;
  note?: string | null;
}
class UpdateGroupDto {
  static schema = groupUpdateSchema;
  title?: string;
  restaurantId?: string;
  deadlineAt?: string | null;
  note?: string | null;
}
class TransitionDto {
  static schema = transitionInputSchema;
  to!: GroupStatus;
}
@Controller('groups')
export class GroupController {
  constructor(private readonly groups: GroupService) {}
  @Post() create(@Body() body: CreateGroupDto) {
    return this.groups.create(body as GroupInput);
  }
  @Get() list(@Query('status') status = 'OPEN') {
    const parsed = groupStatusSchema.safeParse(status);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '揪團狀態無效',
      });
    return this.groups.list(parsed.data);
  }
  @Get(':slug') get(@Param('slug') slug: string) {
    return this.groups.snapshot(slug);
  }
  @Patch(':slug') @UseGuards(AdminGuard) update(
    @Param('slug') slug: string,
    @Body() body: UpdateGroupDto,
  ) {
    return this.groups.update(slug, body);
  }
  @Post(':slug/transitions') @UseGuards(AdminGuard) change(
    @Param('slug') slug: string,
    @Body() body: TransitionDto,
  ) {
    return this.groups.transition(slug, body.to);
  }
}
