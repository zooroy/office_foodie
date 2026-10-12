import { PrismaClient } from '@prisma/client';
import { seedDemo } from '../dist/demo/seed-data.js';
const prisma = new PrismaClient();
try {
  await seedDemo(prisma);
  console.log('Demo seed loaded');
} finally {
  await prisma.$disconnect();
}
