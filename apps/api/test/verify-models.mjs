import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const indexes = await prisma.$queryRaw`
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'Participant'
  `;
  if (
    !indexes.some(
      ({ indexdef }) =>
        /UNIQUE/.test(indexdef) && /"groupId", "nicknameKey"/.test(indexdef),
    )
  ) {
    throw new Error('Missing unique group nickname constraint');
  }
  console.log(
    'Verified Participant(groupId, nicknameKey) unique index in PostgreSQL',
  );
} finally {
  await prisma.$disconnect();
}
