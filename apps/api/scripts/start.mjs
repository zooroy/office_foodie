import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const migration = spawnSync(
  process.execPath,
  [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
  { stdio: 'inherit' },
);
if (migration.status !== 0) process.exit(migration.status ?? 1);
if (process.env.DEMO_MODE === 'true') {
  const seed = spawnSync(process.execPath, ['prisma/seed.ts'], {
    stdio: 'inherit',
  });
  if (seed.status !== 0) process.exit(seed.status ?? 1);
}
await import('../dist/main.js');
