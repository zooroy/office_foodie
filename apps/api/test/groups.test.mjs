import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
describe('creating, publishing and editing groups', () => {
  let f, r;
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    r = await f.prisma.restaurant.create({
      data: { name: '便當', items: { create: { name: '飯', price: 100 } } },
    });
  });
  afterAll(async () => {
    await f?.close();
  });
  const create = async () =>
    (
      await f.http
        .post('/groups')
        .send({ title: '午餐', restaurantId: r.id })
        .expect(201)
    ).body;
  it('returns the admin secret once and omits all credentials from snapshots', async () => {
    const created = await create();
    expect(created.slug).toHaveLength(10);
    await f.http
      .post(`/groups/${created.slug}/participants`)
      .send({ nickname: '王' })
      .expect(201);
    const result = await f.http.get(`/groups/${created.slug}`).expect(200);
    expect(result.body.status).toBe('DRAFT');
    expect(JSON.stringify(result.body)).not.toMatch(
      /adminSecret|tokenHash|participantToken|nicknameKey/,
    );
  });
  it('lists only open groups and never exposes management links', async () => {
    const first = await create();
    await create();
    await f.http
      .post(`/groups/${first.slug}/transitions`)
      .set('X-Admin-Secret', first.adminSecret)
      .send({ to: 'OPEN' })
      .expect(201);
    const result = await f.http.get('/groups?status=OPEN').expect(200);
    expect(result.body).toHaveLength(1);
    expect(result.body[0].slug).toBe(first.slug);
    expect(JSON.stringify(result.body)).not.toContain(first.adminSecret);
  });
  it('requires a title and restaurant', async () => {
    await f.http.post('/groups').send({ title: '午餐' }).expect(400);
    await f.http
      .post('/groups')
      .send({ title: ' ', restaurantId: r.id })
      .expect(400);
  });
  it('rejects publishing an empty menu', async () => {
    await f.prisma.menuItem.updateMany({ data: { deletedAt: new Date() } });
    const group = await create();
    const result = await f.http
      .post(`/groups/${group.slug}/transitions`)
      .set('X-Admin-Secret', group.adminSecret)
      .send({ to: 'OPEN' })
      .expect(409);
    expect(result.body.code).toBe('EMPTY_MENU');
  });
  it('rejects non-admin changes and changing restaurants after publication', async () => {
    const g = await create();
    const other = await f.prisma.restaurant.create({ data: { name: '其他' } });
    await f.http
      .patch(`/groups/${g.slug}`)
      .send({ title: 'wrong' })
      .expect(401);
    await f.http
      .post(`/groups/${g.slug}/transitions`)
      .set('X-Admin-Secret', 'wrong')
      .send({ to: 'OPEN' })
      .expect(403);
    await f.http
      .post(`/groups/${g.slug}/transitions`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ to: 'OPEN' })
      .expect(201);
    await f.http
      .patch(`/groups/${g.slug}`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ restaurantId: other.id })
      .expect(409);
    const edited = await f.http
      .patch(`/groups/${g.slug}`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ title: '延後', deadlineAt: '2000-01-01T00:00:00Z' })
      .expect(200);
    expect(edited.body.status).toBe('OPEN');
  });
  it('allows changing restaurants only while draft and forbids final-state edits', async () => {
    const g = await create();
    const other = await f.prisma.restaurant.create({ data: { name: '其他' } });
    await f.http
      .patch(`/groups/${g.slug}`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ restaurantId: other.id })
      .expect(200);
    await f.http
      .post(`/groups/${g.slug}/transitions`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ to: 'CANCELLED' })
      .expect(201);
    await f.http
      .patch(`/groups/${g.slug}`)
      .set('X-Admin-Secret', g.adminSecret)
      .send({ title: 'invalid' })
      .expect(409);
  });
});
