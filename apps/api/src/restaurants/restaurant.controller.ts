import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  restaurantInputSchema,
  restaurantUpdateSchema,
} from '@office-foodie/shared';
import { PrismaService } from '../database/prisma.service.js';

class CreateRestaurantDto {
  static schema = restaurantInputSchema;
  name!: string;
  phone?: string | null;
  address?: string | null;
}
class UpdateRestaurantDto {
  static schema = restaurantUpdateSchema;
  name?: string;
  phone?: string | null;
  address?: string | null;
}
@Controller('restaurants')
export class RestaurantController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  list(@Query('q') q?: string) {
    return this.prisma.restaurant.findMany({
      where:
        typeof q === 'string' && q.trim()
          ? { name: { contains: q.trim(), mode: 'insensitive' } }
          : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  @Post()
  create(@Body() body: CreateRestaurantDto) {
    return this.prisma.restaurant.create({ data: body });
  }
  @Get(':id')
  async get(@Param('id') id: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!restaurant)
      throw new NotFoundException({ code: 'NOT_FOUND', message: '找不到餐廳' });
    return restaurant;
  }
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateRestaurantDto) {
    await this.get(id);
    return this.prisma.restaurant.update({ where: { id }, data: body });
  }
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM "Restaurant" WHERE id = ${id} FOR UPDATE`;
        if (!rows.length)
          throw new NotFoundException({
            code: 'NOT_FOUND',
            message: '找不到餐廳',
          });
        if (await tx.group.count({ where: { restaurantId: id } }))
          throw new ConflictException({
            code: 'RESTAURANT_IN_USE',
            message: '已有揪團使用此餐廳，無法刪除',
          });
        await tx.menuItem.deleteMany({ where: { restaurantId: id } });
        await tx.restaurant.delete({ where: { id } });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      )
        throw new ConflictException({
          code: 'RESTAURANT_IN_USE',
          message: '已有揪團使用此餐廳，無法刪除',
        });
      throw error;
    }
  }
}
