import {
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  menuItemInputSchema,
  menuItemUpdateSchema,
  menuBatchInputSchema,
} from '@office-foodie/shared';
import type { MenuItemInput } from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';

class MenuInputDto {
  static schema = menuItemInputSchema;
  name!: string;
  price!: number;
  category?: string | null;
  sortOrder?: number;
}
class MenuUpdateDto {
  static schema = menuItemUpdateSchema;
  name?: string;
  price?: number;
  category?: string | null;
  sortOrder?: number;
}
class BatchDto {
  static schema = menuBatchInputSchema;
  items!: MenuItemInput[];
}
@Controller()
export class MenuController {
  constructor(private readonly prisma: PrismaService) {}
  private async restaurant(id: string) {
    if (!(await this.prisma.restaurant.findUnique({ where: { id } })))
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到餐廳' });
  }
  private async item(id: string) {
    if (
      !(await this.prisma.menuItem.findFirst({
        where: { id, deletedAt: null },
      }))
    )
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: '找不到菜單品項',
      });
  }
  @Post('restaurants/:id/items')
  async create(@Param('id') restaurantId: string, @Body() body: MenuInputDto) {
    await this.restaurant(restaurantId);
    return this.prisma.menuItem.create({ data: { ...body, restaurantId } });
  }
  @Put('restaurants/:id/items')
  async batch(@Param('id') restaurantId: string, @Body() body: BatchDto) {
    await this.restaurant(restaurantId);
    return this.prisma.$transaction(
      body.items.map((item) =>
        this.prisma.menuItem.create({ data: { ...item, restaurantId } }),
      ),
    );
  }
  @Patch('menu-items/:id')
  async update(@Param('id') id: string, @Body() body: MenuUpdateDto) {
    await this.item(id);
    return this.prisma.menuItem.update({ where: { id }, data: body });
  }
  @Delete('menu-items/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.item(id);
    await this.prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
