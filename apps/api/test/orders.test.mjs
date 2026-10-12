import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
describe('order authorization, snapshots and closing race', () => {
  let f, g, item, p, other;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    const r = await f.prisma.restaurant.create({
      data: { name: '便當', items: { create: { name: '飯', price: 100 } } },
    });
    item = await f.prisma.menuItem.findFirst();
    g = (
      await f.http.post('/groups').send({ title: '午餐', restaurantId: r.id })
    ).body;
    await f.http
      .post(`/groups/${g.slug}/transitions`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ to: 'OPEN' })
      .expect(201);
    p = (
      await f.http
        .post(`/groups/${g.slug}/participants`)
        .send({ nickname: '王' })
    ).body;
    other = (
      await f.http
        .post(`/groups/${g.slug}/participants`)
        .send({ nickname: '李' })
    ).body;
  });
  afterAll(async () => {
    await f?.close();
  });
  const order = async (quantity = 1) =>
    (
      await f.http
        .post(`/groups/${g.slug}/orders`)
        .set('X-Participant-Token', p.participantToken)
        .send({ menuItemId: item.id, quantity })
        .expect(201)
    ).body;
  const close = () =>
    f.http
      .post(`/groups/${g.slug}/transitions`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ to: 'CLOSED' })
      .expect(201);
  it('uses snapshots even after a menu price or name changes', async () => {
    const o = await order();
    await f.prisma.menuItem.update({
      where: { id: item.id },
      data: { name: '新飯', price: 120 },
    });
    const updated = await f.http
      .patch(`/orders/${o.id}`)
      .set('X-Participant-Token', p.participantToken)
      .send({ quantity: 2, note: '飯少' })
      .expect(200);
    expect(updated.body.nameSnapshot).toBe('飯');
    expect(updated.body.unitPriceSnapshot).toBe(100);
  });
  it('rejects editing or deleting another participant order', async () => {
    const o = await order();
    await f.http
      .patch(`/orders/${o.id}`)
      .set('X-Participant-Token', other.participantToken)
      .send({ quantity: 2 })
      .expect(403);
    await f.http
      .delete(`/orders/${o.id}`)
      .set('X-Participant-Token', other.participantToken)
      .expect(403);
  });
  it.each([0, 100, 1.5])('rejects invalid quantity %s', async (quantity) => {
    await f.http
      .post(`/groups/${g.slug}/orders`)
      .set('X-Participant-Token', p.participantToken)
      .send({ menuItemId: item.id, quantity })
      .expect(400);
  });
  it('rejects notes longer than 100 characters', async () => {
    await f.http
      .post(`/groups/${g.slug}/orders`)
      .set('X-Participant-Token', p.participantToken)
      .send({ menuItemId: item.id, quantity: 1, note: '字'.repeat(101) })
      .expect(400);
  });
  it('prevents participant writes after close but allows admin changes', async () => {
    const o = await order();
    await close();
    await f.http
      .post(`/groups/${g.slug}/orders`)
      .set('X-Participant-Token', p.participantToken)
      .send({ menuItemId: item.id, quantity: 1 })
      .expect(409);
    await f.http
      .patch(`/orders/${o.id}`)
      .set('X-Participant-Token', p.participantToken)
      .send({ quantity: 2 })
      .expect(409);
    await f.http
      .delete(`/orders/${o.id}`)
      .set('X-Admin-Secret', g.adminSecret)
      .expect(204);
    await f.http
      .post(`/groups/${g.slug}/orders`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({
        menuItemId: item.id,
        participantId: p.participant.id,
        quantity: 1,
      })
      .expect(201);
  });
  it('rejects changes that make the amount negative without changing the discount', async () => {
    const o = await order(2);
    await f.prisma.participant.update({
      where: { id: p.participant.id },
      data: { adjustment: -150 },
    });
    const result = await f.http
      .patch(`/orders/${o.id}`)
      .set('X-Participant-Token', p.participantToken)
      .send({ quantity: 1 })
      .expect(409);
    expect(result.body.code).toBe('NEGATIVE_AMOUNT');
    await f.http
      .delete(`/orders/${o.id}`)
      .set('X-Admin-Secret', g.adminSecret)
      .expect(409);
    expect(
      (await f.prisma.orderItem.findUnique({ where: { id: o.id } })).quantity,
    ).toBe(2);
    expect(
      (
        await f.prisma.participant.findUnique({
          where: { id: p.participant.id },
        })
      ).adjustment,
    ).toBe(-150);
  });
  it('serializes closing and concurrent order writes', async () => {
    const writes = Array.from({ length: 12 }, () =>
      f.http
        .post(`/groups/${g.slug}/orders`)
        .set('X-Participant-Token', p.participantToken)
        .send({ menuItemId: item.id, quantity: 1 })
        .then((result) => result),
    );
    await close();
    const atClose = await f.prisma.orderItem.count();
    const results = await Promise.all(writes);
    expect(results.every((result) => [201, 409].includes(result.status))).toBe(
      true,
    );
    expect(await f.prisma.orderItem.count()).toBe(atClose);
    await f.http
      .post(`/groups/${g.slug}/orders`)
      .set('X-Participant-Token', p.participantToken)
      .send({ menuItemId: item.id, quantity: 1 })
      .expect(409);
  });
});
