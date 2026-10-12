import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
describe('menu editing and snapshots', () => {
  let f, r;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    r = await f.prisma.restaurant.create({ data: { name: '便當' } });
  });
  afterAll(async () => {
    await f?.close();
  });
  it.each([-1, 99.5])(
    'rejects invalid price %s on single and batch writes',
    async (price) => {
      await f.http
        .post(`/restaurants/${r.id}/items`)
        .send({ name: '飯', price })
        .expect(400);
      await f.http
        .put(`/restaurants/${r.id}/items`)
        .send({
          items: [
            { name: '飯', price: 100 },
            { name: '蛋', price },
          ],
        })
        .expect(400);
      expect(await f.prisma.menuItem.count()).toBe(0);
    },
  );
  it('creates, changes and soft deletes menu items', async () => {
    const a = await f.http
      .post(`/restaurants/${r.id}/items`)
      .send({ name: '飯', price: 100, category: '主食' })
      .expect(201);
    await f.http
      .patch(`/menu-items/${a.body.id}`)
      .send({ price: 110, category: '便當' })
      .expect(200);
    await f.http.delete(`/menu-items/${a.body.id}`).expect(204);
    const result = await f.http.get(`/restaurants/${r.id}`).expect(200);
    expect(result.body.items).toEqual([]);
    expect(
      (await f.prisma.menuItem.findUniqueOrThrow({ where: { id: a.body.id } }))
        .deletedAt,
    ).not.toBeNull();
    await f.http
      .patch(`/menu-items/${a.body.id}`)
      .send({ price: 120 })
      .expect(404);
  });
  it('adds a confirmed batch without removing the existing menu', async () => {
    await f.http
      .post(`/restaurants/${r.id}/items`)
      .send({ name: '既有', price: 0 })
      .expect(201);
    await f.http
      .put(`/restaurants/${r.id}/items`)
      .send({
        items: [
          { name: '飯', price: 100 },
          { name: '蛋', price: 15 },
        ],
      })
      .expect(200);
    expect((await f.http.get(`/restaurants/${r.id}`)).body.items).toHaveLength(
      3,
    );
  });
  it('preserves historical order names and prices after menu changes and deletion', async () => {
    const item = await f.prisma.menuItem.create({
      data: { restaurantId: r.id, name: '飯', price: 100 },
    });
    const group = await f.prisma.group.create({
      data: {
        slug: 'snapshot',
        title: '午餐',
        restaurantId: r.id,
        adminSecretHash: 'hash',
      },
    });
    const participant = await f.prisma.participant.create({
      data: {
        groupId: group.id,
        nickname: '王',
        nicknameKey: '王',
        tokenHash: 'hash',
      },
    });
    const order = await f.prisma.orderItem.create({
      data: {
        participantId: participant.id,
        menuItemId: item.id,
        nameSnapshot: '飯',
        unitPriceSnapshot: 100,
        quantity: 1,
      },
    });
    await f.http
      .patch(`/menu-items/${item.id}`)
      .send({ name: '新飯', price: 120 })
      .expect(200);
    await f.http.delete(`/menu-items/${item.id}`).expect(204);
    const preserved = await f.prisma.orderItem.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(preserved.nameSnapshot).toBe('飯');
    expect(preserved.unitPriceSnapshot).toBe(100);
    expect(preserved.menuItemId).toBe(item.id);
  });
});
