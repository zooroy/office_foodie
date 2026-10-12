import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { RestaurantController } from './restaurants/restaurant.controller.js';
import { MenuController } from './restaurants/menu.controller.js';
import { ExtractionModule } from './extraction/extraction.module.js';
import { GroupModule } from './groups/group.module.js';

@Module({
  imports: [DatabaseModule, IdentityModule, ExtractionModule, GroupModule],
  controllers: [AppController, RestaurantController, MenuController],
})
export class AppModule {}
