import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { DatabaseModule } from './database/database.module.js';
import { IdentityModule } from './identity/identity.module.js';

@Module({
  imports: [DatabaseModule, IdentityModule],
  controllers: [AppController],
})
export class AppModule {}
