import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  jest,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
import { seedDemo, DEMO_ADMIN_SECRET } from '../dist/demo/seed-data.js';
import { SimulationService } from '../dist/demo/simulation.service.js';
import { setTimeout as realDelay } from 'node:timers/promises';
describe('demo seed, reset and simulation', () => {
  let f;
  const previousMode = process.env.DEMO_MODE;
  const previousToken = process.env.DEMO_RESET_TOKEN;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_RESET_TOKEN = 'test-reset';
  });
  afterAll(async () => {
    jest.useRealTimers();
    if (previousMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousMode;
    if (previousToken === undefined) delete process.env.DEMO_RESET_TOKEN;
    else process.env.DEMO_RESET_TOKEN = previousToken;
    await f?.close();
  });
  it('seeds repeatedly with three menus, five orders and partially paid closed group', async () => {
    await seedDemo(f.prisma);
    await seedDemo(f.prisma);
    expect(await f.prisma.restaurant.count()).toBe(3);
    expect(await f.prisma.menuItem.count()).toBe(9);
    const open = (await f.http.get('/groups/demo-lunch').expect(200)).body;
    expect(open.status).toBe('OPEN');
    expect(open.participants).toHaveLength(5);
    expect(open.participants.every((p) => p.orders.length === 1)).toBe(true);
    const closed = (await f.http.get('/groups/demo-closed').expect(200)).body;
    expect(closed.status).toBe('CLOSED');
    expect(
      closed.participants.filter((p) => p.paymentStatus === 'CONFIRMED'),
    ).toHaveLength(2);
  });
  it('requires reset token, hides reset when disabled and restores demo state', async () => {
    await f.http.post('/demo/reset').expect(403);
    process.env.DEMO_MODE = 'false';
    await f.http
      .post('/demo/reset')
      .set('X-Demo-Reset-Token', 'test-reset')
      .expect(404);
    process.env.DEMO_MODE = 'true';
    await seedDemo(f.prisma);
    await f.prisma.group.update({
      where: { slug: 'demo-lunch' },
      data: { status: 'SETTLED' },
    });
    await f.http
      .post('/demo/reset')
      .set('X-Demo-Reset-Token', 'test-reset')
      .expect(201);
    expect((await f.http.get('/groups/demo-lunch')).body.status).toBe('OPEN');
  });
  it('simulates exactly five orders with timers and refuses duplicate or closed runs', async () => {
    await seedDemo(f.prisma);
    const service = f.app.get(SimulationService);
    const before = await f.prisma.orderItem.count();
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'performance'],
    });
    try {
      await service.start('demo-lunch');
      await expect(service.start('demo-lunch')).rejects.toMatchObject({
        response: { code: 'SIMULATION_RUNNING' },
      });
      for (let i = 0; i < 5; i++) {
        const previousTimer = service.timers.get('demo-lunch');
        await jest.advanceTimersByTimeAsync(4000);
        for (let retry = 0; retry < 100; retry++) {
          if (
            (await f.prisma.orderItem.count()) === before + i + 1 &&
            service.timers.get('demo-lunch') !== previousTimer
          )
            break;
          await realDelay(10);
        }
        expect(await f.prisma.orderItem.count()).toBe(before + i + 1);
      }
      await expect(service.start('demo-closed')).rejects.toMatchObject({
        response: { code: 'GROUP_CLOSED' },
      });
    } finally {
      jest.useRealTimers();
    }
    await f.http
      .post('/demo/groups/demo-closed/simulate')
      .set('X-Admin-Secret', DEMO_ADMIN_SECRET)
      .expect(409);
  });
});
