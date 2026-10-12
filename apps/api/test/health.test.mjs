import 'reflect-metadata';
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import request from 'supertest';
import { createTestApp } from './app-factory.mjs';

describe('API health and error responses', () => {
  let app;
  let fixture;

  beforeAll(async () => {
    fixture = await createTestApp();
    app = fixture.app;
  });

  beforeEach(async () => {
    await fixture.reset();
  });

  afterAll(async () => {
    await fixture?.close();
  });

  it('returns a healthy response', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('connects to a real isolated database and clears prior data', async () => {
    await fixture.prisma.restaurant.create({ data: { name: '隔離測試餐廳' } });
    expect(await fixture.prisma.restaurant.count()).toBe(1);
    await fixture.reset();
    expect(await fixture.prisma.restaurant.count()).toBe(0);
  });

  it('returns the unified error format for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('permits the configured frontend origin', async () => {
    const origin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', origin)
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
  });
});
