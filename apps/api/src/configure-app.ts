import { INestApplication } from '@nestjs/common';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { ZodValidationPipe } from './common/zod-validation.pipe.js';

export function configureApp(app: INestApplication) {
  // One reverse proxy hop; do not trust arbitrary chains of forwarded addresses.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });
}
