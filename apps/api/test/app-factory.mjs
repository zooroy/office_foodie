import 'reflect-metadata';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { PrismaService } from '../dist/database/prisma.service.js';
import { configureApp } from '../dist/configure-app.js';

const require = createRequire(import.meta.url);
export async function createTestApp(controllers = []) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL must reference a dedicated database ending in _test',
    );
  }
  execFileSync(
    process.execPath,
    [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
    {
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: 'pipe',
    },
  );
  const prisma = new PrismaService({ datasources: { db: { url } } });
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers,
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  const app = module.createNestApplication();
  configureApp(app);
  await app.init();
  return {
    app,
    prisma,
    http: request(app.getHttpServer()),
    async reset() {
      await prisma.$executeRaw`TRUNCATE TABLE "OrderItem", "Participant", "Group", "MenuItem", "Restaurant", "ExtractionUsage" RESTART IDENTITY CASCADE`;
    },
    async close() {
      await app.close();
    },
  };
}
