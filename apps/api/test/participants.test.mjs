import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { createTestApp } from './app-factory.mjs';
import { hashCredential } from '../dist/identity/credentials.js';

describe('joining a group and restoring participant identity', () => {
  let fixture;
  beforeAll(async () => {
    fixture = await createTestApp();
  });
  beforeEach(async () => {
    await fixture.reset();
    const restaurant = await fixture.prisma.restaurant.create({
      data: { name: '便當' },
    });
    await fixture.prisma.group.create({
      data: {
        slug: 'lunch',
        title: '午餐',
        restaurantId: restaurant.id,
        adminSecretHash: hashCredential('secret'),
      },
    });
  });
  afterAll(async () => {
    await fixture?.close();
  });
  it('joins with a trimmed nickname and restores identity using the token', async () => {
    const joined = await fixture.http
      .post('/groups/lunch/participants')
      .send({ nickname: ' Alice ' })
      .expect(201);
    expect(joined.body.participant.nickname).toBe('Alice');
    expect(joined.body.participantToken).toEqual(expect.any(String));
    const stored = await fixture.prisma.participant.findUniqueOrThrow({
      where: { id: joined.body.participant.id },
    });
    expect(stored.tokenHash).toBe(hashCredential(joined.body.participantToken));
    const me = await fixture.http
      .get('/groups/lunch/me')
      .set('X-Participant-Token', joined.body.participantToken)
      .expect(200);
    expect(me.body).toEqual(joined.body.participant);
    expect(JSON.stringify(me.body)).not.toMatch(
      /tokenHash|nicknameKey|adminSecret/,
    );
  });
  it('rejects duplicate nicknames ignoring case and surrounding whitespace', async () => {
    await fixture.http
      .post('/groups/lunch/participants')
      .send({ nickname: 'Alice' })
      .expect(201);
    const rejected = await fixture.http
      .post('/groups/lunch/participants')
      .send({ nickname: ' alice ' })
      .expect(409);
    expect(rejected.body.code).toBe('NICKNAME_TAKEN');
  });
  it('enforces the database constraint for concurrent joins', async () => {
    const results = await Promise.all(
      ['Alice', ' alice '].map((nickname) =>
        fixture.http.post('/groups/lunch/participants').send({ nickname }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });
  it.each([' ', '王'.repeat(21)])(
    'rejects invalid nickname %j',
    async (nickname) => {
      await fixture.http
        .post('/groups/lunch/participants')
        .send({ nickname })
        .expect(400);
    },
  );
  it('rejects missing and invalid tokens', async () => {
    await fixture.http.get('/groups/lunch/me').expect(401);
    await fixture.http
      .get('/groups/lunch/me')
      .set('X-Participant-Token', 'wrong')
      .expect(403);
  });
});
