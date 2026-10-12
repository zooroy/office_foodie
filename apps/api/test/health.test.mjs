import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';

describe('API health and error responses', () => {
  let app;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a healthy response', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
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
