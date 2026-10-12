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
describe('menu photo uploads', () => {
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
  it('extracts valid images without saving photos or menu items', async () => {
    const result = await f.http
      .post('/menu-extractions')
      .attach('images', png, { filename: 'menu.png', contentType: 'image/png' })
      .expect(201);
    expect(result.body.items).toHaveLength(3);
    expect(await f.prisma.menuItem.count()).toBe(0);
  });
  it('rejects PDF uploads', async () => {
    await f.http
      .post('/menu-extractions')
      .attach('images', Buffer.from('%PDF'), {
        filename: 'menu.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });
  it('rejects a falsely labelled image', async () => {
    await f.http
      .post('/menu-extractions')
      .attach('images', Buffer.from('%PDF'), {
        filename: 'menu.png',
        contentType: 'image/png',
      })
      .expect(400);
  });
  it('rejects files larger than 5MB', async () => {
    await f.http
      .post('/menu-extractions')
      .attach('images', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'menu.png',
        contentType: 'image/png',
      })
      .expect(413);
  });
  it('requires at least one photo', async () => {
    await f.http.post('/menu-extractions').expect(400);
  });
  it('rejects more than five photos', async () => {
    let req = f.http.post('/menu-extractions');
    for (let i = 0; i < 6; i++)
      req = req.attach('images', png, {
        filename: `${i}.png`,
        contentType: 'image/png',
      });
    await req.expect(400);
  });
});
