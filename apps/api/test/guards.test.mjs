import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard, ParticipantGuard } from '../dist/identity/guards.js';
import { hashCredential } from '../dist/identity/credentials.js';
import { createTestApp } from './app-factory.mjs';

class GuardProbe {
  admin() {
    return { ok: true };
  }
  participant() {
    return { ok: true };
  }
}
Controller('groups/:slug')(GuardProbe);
for (const [name, guard] of [
  ['admin', AdminGuard],
  ['participant', ParticipantGuard],
]) {
  const descriptor = Object.getOwnPropertyDescriptor(
    GuardProbe.prototype,
    name,
  );
  Get(`probe-${name}`)(GuardProbe.prototype, name, descriptor);
  UseGuards(guard)(GuardProbe.prototype, name, descriptor);
}

describe('identity guards', () => {
  let fixture;
  beforeAll(async () => {
    fixture = await createTestApp([GuardProbe]);
  });
  beforeEach(async () => {
    await fixture.reset();
    const restaurant = await fixture.prisma.restaurant.create({
      data: { name: '便當' },
    });
    const group = await fixture.prisma.group.create({
      data: {
        slug: 'guard-test',
        title: '午餐',
        restaurantId: restaurant.id,
        adminSecretHash: hashCredential('admin-secret'),
      },
    });
    await fixture.prisma.participant.create({
      data: {
        groupId: group.id,
        nickname: '王',
        nicknameKey: '王',
        tokenHash: hashCredential('participant-token'),
      },
    });
    await fixture.prisma.group.create({
      data: {
        slug: 'another',
        title: '下午茶',
        restaurantId: restaurant.id,
        adminSecretHash: hashCredential('other-secret'),
      },
    });
  });
  afterAll(async () => {
    await fixture?.close();
  });
  for (const [kind, header, credential] of [
    ['admin', 'X-Admin-Secret', 'admin-secret'],
    ['participant', 'X-Participant-Token', 'participant-token'],
  ]) {
    it(`${kind} rejects missing credentials with 401`, async () => {
      const result = await fixture.http
        .get(`/groups/guard-test/probe-${kind}`)
        .expect(401);
      expect(result.body.code).toBe('UNAUTHORIZED');
    });
    it(`${kind} rejects incorrect credentials with 403`, async () => {
      await fixture.http
        .get(`/groups/guard-test/probe-${kind}`)
        .set(header, 'wrong')
        .expect(403);
    });
    it(`${kind} accepts the correct credential`, async () => {
      await fixture.http
        .get(`/groups/guard-test/probe-${kind}`)
        .set(header, credential)
        .expect(200);
    });
    it(`${kind} rejects a credential from another group`, async () => {
      await fixture.http
        .get(`/groups/another/probe-${kind}`)
        .set(header, credential)
        .expect(403);
    });
  }
});
