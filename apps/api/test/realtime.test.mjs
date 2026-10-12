import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { io } from 'socket.io-client';
import { createTestApp } from './app-factory.mjs';
describe('group websocket gateway', () => {
  let f, group;
  const sockets = [];
  beforeAll(async () => {
    f = await createTestApp();
  });
  beforeEach(async () => {
    await f.reset();
    const restaurant = await f.prisma.restaurant.create({
      data: { name: '飯' },
    });
    group = (
      await f.http
        .post('/groups')
        .send({ title: '午餐', restaurantId: restaurant.id })
        .expect(201)
    ).body;
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await f?.close();
  });
  async function connect(
    origin = process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  ) {
    const socket = io(
      `http://127.0.0.1:${f.app.getHttpServer().address().port}`,
      {
        transports: ['websocket'],
        extraHeaders: { Origin: origin },
        reconnection: false,
        timeout: 1500,
      },
    );
    sockets.push(socket);
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }
  it('joins a group room and acknowledges a complete public snapshot', async () => {
    const socket = await connect();
    const snapshot = await socket
      .timeout(2000)
      .emitWithAck('join', { slug: group.slug });
    expect(snapshot.slug).toBe(group.slug);
    expect(snapshot.restaurant.name).toBe('飯');
    expect(snapshot.participants).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toMatch(
      /adminSecret|tokenHash|participantToken/,
    );
    socket.disconnect();
  });
  it('rejects websocket handshakes from other origins', async () => {
    await expect(connect('https://untrusted.example')).rejects.toBeDefined();
  });
  it('publishes committed changes only to the matching room without credentials', async () => {
    const first = await connect();
    const other = await connect();
    await first.timeout(2000).emitWithAck('join', { slug: group.slug });
    const restaurant = await f.prisma.restaurant.findFirst();
    const secondGroup = (
      await f.http
        .post('/groups')
        .send({ title: '另一團', restaurantId: restaurant.id })
    ).body;
    await other.timeout(2000).emitWithAck('join', { slug: secondGroup.slug });
    const received = [];
    for (const name of [
      'participant.joined',
      'order.changed',
      'group.updated',
      'payment.updated',
    ])
      other.on(name, (value) => received.push(value));
    async function mutation(event, write) {
      const pushed = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('missing event')),
          2000,
        );
        first.once(event, (snapshot) => {
          clearTimeout(timer);
          resolve(snapshot);
        });
      });
      await write();
      const snapshot = await pushed;
      expect(snapshot.slug).toBe(group.slug);
      expect(JSON.stringify(snapshot)).not.toMatch(
        /adminSecret|tokenHash|participantToken|nicknameKey/,
      );
      return snapshot;
    }
    let joined;
    await mutation('participant.joined', async () => {
      joined = (
        await f.http
          .post(`/groups/${group.slug}/participants`)
          .send({ nickname: '同事' })
          .expect(201)
      ).body;
    });
    const item = await f.prisma.menuItem.create({
      data: { restaurantId: restaurant.id, name: '飯', price: 100 },
    });
    await mutation('group.updated', () =>
      f.http
        .post(`/groups/${group.slug}/transitions`)
        .set('X-Admin-Secret', group.adminSecret)
        .send({ to: 'OPEN' })
        .expect(201),
    );
    let order;
    const added = await mutation('order.changed', async () => {
      order = (
        await f.http
          .post(`/groups/${group.slug}/orders`)
          .set('X-Participant-Token', joined.participantToken)
          .send({ menuItemId: item.id, quantity: 2 })
          .expect(201)
      ).body;
    });
    expect(added.participants[0].orders[0].quantity).toBe(2);
    await mutation('order.changed', () =>
      f.http
        .patch(`/orders/${order.id}`)
        .set('X-Participant-Token', joined.participantToken)
        .send({ quantity: 3 })
        .expect(200),
    );
    await mutation('group.updated', () =>
      f.http
        .patch(`/groups/${group.slug}`)
        .set('X-Admin-Secret', group.adminSecret)
        .send({ title: '改標題' })
        .expect(200),
    );
    const adjusted = await mutation('payment.updated', () =>
      f.http
        .patch(`/participants/${joined.participant.id}/adjustment`)
        .set('X-Admin-Secret', group.adminSecret)
        .send({ adjustment: -10 })
        .expect(200),
    );
    expect(adjusted.participants[0].adjustment).toBe(-10);
    await mutation('group.updated', () =>
      f.http
        .post(`/groups/${group.slug}/transitions`)
        .set('X-Admin-Secret', group.adminSecret)
        .send({ to: 'CLOSED' })
        .expect(201),
    );
    const paid = await mutation('payment.updated', () =>
      f.http
        .patch(`/participants/${joined.participant.id}/payment`)
        .set('X-Participant-Token', joined.participantToken)
        .send({ paymentStatus: 'REPORTED' })
        .expect(200),
    );
    expect(paid.participants[0].paymentStatus).toBe('REPORTED');
    await mutation('payment.updated', () =>
      f.http
        .patch(`/participants/${joined.participant.id}/adjustment`)
        .set('X-Admin-Secret', group.adminSecret)
        .send({ adjustment: 0 })
        .expect(200),
    );
    await mutation('order.changed', () =>
      f.http
        .delete(`/orders/${order.id}`)
        .set('X-Admin-Secret', group.adminSecret)
        .expect(204),
    );
    first.disconnect();
    const reconnected = await connect();
    const latest = await reconnected
      .timeout(2000)
      .emitWithAck('join', { slug: group.slug });
    expect(latest.title).toBe('改標題');
    expect(latest.participants[0].orders).toEqual([]);
    expect(received).toEqual([]);
    other.disconnect();
    reconnected.disconnect();
  });
  it('acknowledges invalid and missing groups with a structured error', async () => {
    const socket = await connect();
    expect(await socket.timeout(2000).emitWithAck('join', {})).toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(
      await socket.timeout(2000).emitWithAck('join', { slug: 'missing' }),
    ).toMatchObject({ code: 'NOT_FOUND' });
    socket.disconnect();
  });
});
