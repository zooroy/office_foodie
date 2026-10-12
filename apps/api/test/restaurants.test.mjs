import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';

describe('restaurant CRUD and search', () => {
  let f;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
  });
  afterAll(async () => {
    await f?.close();
  });
  it('creates, reads, updates and searches restaurants', async () => {
    const created = await f.http
      .post('/restaurants')
      .send({ name: ' 阿姨便當 ', phone: '123' })
      .expect(201);
    expect(created.body.name).toBe('阿姨便當');
    await f.http.post('/restaurants').send({ name: '下午茶' }).expect(201);
    const result = await f.http.get('/restaurants?q=便當').expect(200);
    expect(result.body.map((r) => r.name)).toEqual(['阿姨便當']);
    await f.http
      .patch(`/restaurants/${created.body.id}`)
      .send({ name: '新便當', phone: null })
      .expect(200);
    const read = await f.http
      .get(`/restaurants/${created.body.id}`)
      .expect(200);
    expect(read.body.name).toBe('新便當');
    expect(read.body.phone).toBeNull();
  });
  it.each([{}, { name: '' }, { name: '   ' }])(
    'requires a restaurant name: %j',
    async (body) => {
      await f.http.post('/restaurants').send(body).expect(400);
    },
  );
  it('deletes an unused restaurant and its menu', async () => {
    const r = await f.prisma.restaurant.create({
      data: { name: 'unused', items: { create: { name: 'rice', price: 100 } } },
    });
    await f.http.delete(`/restaurants/${r.id}`).expect(204);
    await f.http.get(`/restaurants/${r.id}`).expect(404);
    expect(await f.prisma.menuItem.count()).toBe(0);
  });
  it.each(['DRAFT', 'OPEN', 'CLOSED', 'ORDERED', 'SETTLED', 'CANCELLED'])(
    'refuses deletion when a %s group uses the restaurant',
    async (status) => {
      const r = await f.prisma.restaurant.create({ data: { name: 'used' } });
      await f.prisma.group.create({
        data: {
          slug: 'existing',
          title: 'lunch',
          restaurantId: r.id,
          status,
          adminSecretHash: 'hash',
        },
      });
      const response = await f.http.delete(`/restaurants/${r.id}`).expect(409);
      expect(response.body.code).toBe('RESTAURANT_IN_USE');
      expect(await f.prisma.restaurant.count()).toBe(1);
      expect(await f.prisma.group.count()).toBe(1);
    },
  );
  it('returns 404 for deleting a missing restaurant', async () => {
    await f.http.delete('/restaurants/missing').expect(404);
  });
});
