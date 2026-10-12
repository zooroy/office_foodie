import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
describe('persistent menu extraction quotas', () => {
  let f;
  const original = process.env.EXTRACTION_GLOBAL_DAILY_LIMIT;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    delete process.env.EXTRACTION_GLOBAL_DAILY_LIMIT;
  });
  afterAll(async () => {
    await f?.close();
    if (original === undefined)
      delete process.env.EXTRACTION_GLOBAL_DAILY_LIMIT;
    else process.env.EXTRACTION_GLOBAL_DAILY_LIMIT = original;
  });
  const upload = (ip) =>
    f.http
      .post('/menu-extractions')
      .set('X-Forwarded-For', ip)
      .attach('images', png, {
        filename: 'menu.png',
        contentType: 'image/png',
      });
  it('rejects the sixth request from an IP and keeps its count in PostgreSQL', async () => {
    for (let i = 0; i < 5; i++) await upload('203.0.113.1').expect(201);
    const result = await upload('203.0.113.1').expect(429);
    expect(result.body.code).toBe('EXTRACTION_LIMIT');
    expect(
      (
        await f.prisma.extractionUsage.findFirst({
          where: { ip: '203.0.113.1' },
        })
      ).count,
    ).toBe(5);
    await upload('203.0.113.2').expect(201);
  });
  it('enforces the global daily limit across different IPs', async () => {
    process.env.EXTRACTION_GLOBAL_DAILY_LIMIT = '2';
    await upload('203.0.113.1').expect(201);
    await upload('203.0.113.2').expect(201);
    await upload('203.0.113.3').expect(429);
  });
  it('serializes concurrent quota reservations', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => upload('203.0.113.1')),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 429)).toHaveLength(1);
  });
  it('trusts only the nearest proxy address in a forwarded chain', async () => {
    await upload('198.51.100.1, 203.0.113.2').expect(201);
    expect((await f.prisma.extractionUsage.findFirst()).ip).toBe('203.0.113.2');
  });
  it('preserves the quota when the application is restarted', async () => {
    for (let i = 0; i < 5; i++) await upload('203.0.113.1').expect(201);
    await f.close();
    f = await createTestApp();
    await upload('203.0.113.1').expect(429);
  });
});
