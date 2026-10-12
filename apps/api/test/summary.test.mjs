import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { calculateSummary } from '../dist/summary/calculate.js';
import { createTestApp } from './app-factory.mjs';
const person = (
  id,
  quantity,
  adjustment = 0,
  paymentStatus = 'UNPAID',
  price = 100,
) => ({
  id,
  nickname: id,
  adjustment,
  paymentStatus,
  orders: quantity
    ? [{ nameSnapshot: '飯', unitPriceSnapshot: price, quantity, note: '飯少' }]
    : [],
});
describe('summary calculations', () => {
  it('merges matching name and price, keeps notes and excludes people without orders', () => {
    const result = calculateSummary([
      person('a', 1, -10, 'CONFIRMED'),
      person('b', 2, 0, 'REPORTED'),
      person('c', 0),
      person('d', 1, 0, 'UNPAID', 120),
    ]);
    expect(result.items).toEqual([
      {
        name: '飯',
        unitPrice: 100,
        quantity: 3,
        subtotal: 300,
        notes: ['飯少', '飯少'],
      },
      {
        name: '飯',
        unitPrice: 120,
        quantity: 1,
        subtotal: 120,
        notes: ['飯少'],
      },
    ]);
    expect(result.participants).toHaveLength(3);
    expect(result).toMatchObject({
      itemTotal: 420,
      totalDue: 410,
      totalPaid: 90,
      totalUnpaid: 320,
    });
  });
  it('rejects a negative amount and allows zero', () => {
    expect(() => calculateSummary([person('a', 1, -101)])).toThrow();
    expect(calculateSummary([person('a', 1, -100)]).totalDue).toBe(0);
  });
});
describe('adjustments and payments', () => {
  let f, group, joined, second;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    const restaurant = await f.prisma.restaurant.create({
      data: { name: '店', items: { create: { name: '飯', price: 100 } } },
      include: { items: true },
    });
    group = (
      await f.http
        .post('/groups')
        .send({ title: '午餐', restaurantId: restaurant.id })
    ).body;
    await f.http
      .post(`/groups/${group.slug}/transitions`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ to: 'OPEN' })
      .expect(201);
    joined = (
      await f.http
        .post(`/groups/${group.slug}/participants`)
        .send({ nickname: 'a' })
    ).body;
    second = (
      await f.http
        .post(`/groups/${group.slug}/participants`)
        .send({ nickname: 'b' })
    ).body;
    await f.http
      .post(`/groups/${group.slug}/orders`)
      .set('X-Participant-Token', joined.participantToken)
      .send({ menuItemId: restaurant.items[0].id, quantity: 2 })
      .expect(201);
  });
  afterAll(async () => {
    await f?.close();
  });
  const path = () => `/participants/${joined.participant.id}`;
  const close = () =>
    f.http
      .post(`/groups/${group.slug}/transitions`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ to: 'CLOSED' })
      .expect(201);
  it('updates statistics immediately and rejects negative adjustments without writes', async () => {
    await f.http
      .patch(`${path()}/adjustment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ adjustment: -15 })
      .expect(200);
    expect(
      (await f.http.get(`/groups/${group.slug}/summary`).expect(200)).body,
    ).toMatchObject({ totalDue: 185, totalPaid: 0, totalUnpaid: 185 });
    await f.http
      .patch(`${path()}/adjustment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ adjustment: -201 })
      .expect(409);
    expect(
      (
        await f.prisma.participant.findUnique({
          where: { id: joined.participant.id },
        })
      ).adjustment,
    ).toBe(-15);
    await f.http
      .patch(`${path()}/adjustment`)
      .set('X-Participant-Token', joined.participantToken)
      .send({ adjustment: 1 })
      .expect(401);
  });
  it('only accepts payments while closed or ordered and forbids self-confirmation', async () => {
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Participant-Token', joined.participantToken)
      .send({ paymentStatus: 'REPORTED' })
      .expect(409);
    await close();
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Participant-Token', second.participantToken)
      .send({ paymentStatus: 'REPORTED' })
      .expect(403);
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Participant-Token', joined.participantToken)
      .send({ paymentStatus: 'CONFIRMED' })
      .expect(403);
    for (const paymentStatus of ['REPORTED', 'UNPAID'])
      await f.http
        .patch(`${path()}/payment`)
        .set('X-Participant-Token', joined.participantToken)
        .send({ paymentStatus })
        .expect(200);
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ paymentStatus: 'CONFIRMED' })
      .expect(200);
    expect(
      (await f.http.get(`/groups/${group.slug}/summary`)).body,
    ).toMatchObject({ totalPaid: 200, totalUnpaid: 0 });
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Participant-Token', joined.participantToken)
      .send({ paymentStatus: 'UNPAID' })
      .expect(403);
    await f.http
      .post(`/groups/${group.slug}/transitions`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ to: 'ORDERED' })
      .expect(201);
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ paymentStatus: 'UNPAID' })
      .expect(200);
    await f.http
      .post(`/groups/${group.slug}/transitions`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ to: 'SETTLED' })
      .expect(201);
    await f.http
      .patch(`${path()}/payment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ paymentStatus: 'CONFIRMED' })
      .expect(409);
    await f.http
      .patch(`${path()}/adjustment`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ adjustment: 1 })
      .expect(409);
  });
});
