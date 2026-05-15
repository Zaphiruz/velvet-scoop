import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../test/helpers/db.js';
import { createTestApp, type TestAppHandle } from '../test/helpers/test-app.js';

describe('request-messages routes', () => {
  let h: TestAppHandle;

  beforeAll(async () => {
    h = await createTestApp();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedItem() {
    return h.prisma.item.create({
      data: {
        name: `Item-${Math.random().toString(36).slice(2, 7)}`,
        description: 'd',
        cost: '4.50',
        active: true,
      },
    });
  }

  async function seedRequest(userId: string) {
    const item = await seedItem();
    return h.prisma.request.create({
      data: {
        userId,
        total: '4.50',
        scheduledFor: new Date('2026-08-01T18:00:00Z'),
        contactName: 'C',
        contactEmail: 'c@example.com',
        items: { create: [{ itemId: item.id, quantity: 1 }] },
      },
    });
  }

  describe('GET /api/requests/:id/messages', () => {
    it('returns empty array for the request owner', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('returns 403 for an unrelated member', async () => {
      const customer = await h.createUser();
      const stranger = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(stranger.id) },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 for an admin who is not isOwner', async () => {
      const customer = await h.createUser();
      const admin = await h.createUser({ role: 'admin' });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(admin.id) },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 200 for an owner (admin + isOwner)', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(owner.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('returns 404 for a non-existent request', async () => {
      const customer = await h.createUser();
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/00000000-0000-0000-0000-000000000000/messages`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/requests/:id/messages', () => {
    it('customer can send while pending and the message is returned', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'hello there' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json().data;
      expect(body.content).toBe('hello there');
      expect(body.senderId).toBe(customer.id);
      expect(body.deleted).toBe(false);
      expect(body.readAt).toBeNull();
    });

    it('owner can send on someone else\'s request', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(owner.id), 'content-type': 'application/json' },
        payload: { content: 'on it' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.senderId).toBe(owner.id);
    });

    it('returns 409 THREAD_CLOSED on a completed request', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      await h.prisma.request.update({
        where: { id: req1.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'late reply' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('THREAD_CLOSED');
    });

    it('rejects empty content with 400', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects content over 4000 chars with 400', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'a'.repeat(4001) },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('push notifications on send', () => {
    it('customer send invokes sendToOwners with correct title and url', async () => {
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const owners: Array<{ title: string; body: string; url?: string }> = [];
      const usersTo: Array<{ userId: string; payload: { title: string } }> = [];

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: true,
        pushService: {
          publicKey: 'test-vapid',
          async sendToUser(userId, payload) { usersTo.push({ userId, payload }); },
          async sendToOwners(payload) { owners.push(payload); },
        },
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(customer.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        const res = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'I have a question' },
        });
        expect(res.statusCode).toBe(201);

        // Fire-and-forget — let the notification settle.
        await new Promise((r) => setTimeout(r, 50));

        expect(owners).toHaveLength(1);
        expect(owners[0]!.title).toMatch(/Message on order #\d+/);
        expect(owners[0]!.body).toContain('I have a question');
        expect(usersTo).toHaveLength(0);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });

    it('owner reply invokes sendToUser targeting the customer', async () => {
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const usersTo: Array<{ userId: string; payload: { title: string; body: string } }> = [];
      const ownersTo: Array<unknown> = [];

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: true,
        pushService: {
          publicKey: 'test-vapid',
          async sendToUser(userId, payload) { usersTo.push({ userId, payload }); },
          async sendToOwners(payload) { ownersTo.push(payload); },
        },
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const owner = await h.createUser({ role: 'admin' });
        await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(owner.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        const res = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'on it' },
        });
        expect(res.statusCode).toBe(201);

        await new Promise((r) => setTimeout(r, 50));

        expect(usersTo).toHaveLength(1);
        expect(usersTo[0]!.userId).toBe(customer.id);
        expect(usersTo[0]!.payload.title).toMatch(/reply from Velvet Scoop/);
        expect(ownersTo).toHaveLength(0);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });
  });

  describe('POST /api/requests/:id/messages/read', () => {
    it('flips readAt only on counterparty messages', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);

      const fromOwner = await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: owner.id, content: 'from owner' },
      });
      const fromCustomer = await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: customer.id, content: 'from customer' },
      });

      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages/read`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.updated).toBe(1);

      const after = await h.prisma.requestMessage.findMany({
        where: { requestId: req1.id },
        orderBy: { createdAt: 'asc' },
      });
      const ownerRow = after.find((m) => m.id === fromOwner.id)!;
      const customerRow = after.find((m) => m.id === fromCustomer.id)!;
      expect(ownerRow.readAt).not.toBeNull();
      expect(customerRow.readAt).toBeNull();
    });

    it('is idempotent: second call returns updated: 0', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: owner.id, content: 'a' },
      });
      const cookie = await h.cookieFor(customer.id);
      const first = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages/read`, headers: { cookie },
      });
      expect(first.json().data.updated).toBe(1);
      const second = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages/read`, headers: { cookie },
      });
      expect(second.json().data.updated).toBe(0);
    });
  });

  describe('DELETE /api/requests/:id/messages/:msgId', () => {
    it('sender can soft-delete their own message; subsequent GET returns deleted:true content:null', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const cookie = await h.cookieFor(customer.id);

      const send = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { content: 'oops' },
      });
      const msgId = send.json().data.id;

      const del = await h.app.inject({
        method: 'DELETE', url: `/api/requests/${req1.id}/messages/${msgId}`, headers: { cookie },
      });
      expect(del.statusCode).toBe(200);

      const list = await h.app.inject({
        method: 'GET', url: `/api/requests/${req1.id}/messages`, headers: { cookie },
      });
      const data = list.json().data;
      expect(data).toHaveLength(1);
      expect(data[0].deleted).toBe(true);
      expect(data[0].content).toBeNull();
    });

    it('non-sender owner cannot delete the customer\'s message', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);

      const send = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'mine' },
      });
      const msgId = send.json().data.id;

      const del = await h.app.inject({
        method: 'DELETE', url: `/api/requests/${req1.id}/messages/${msgId}`,
        headers: { cookie: await h.cookieFor(owner.id) },
      });
      expect(del.statusCode).toBe(403);
    });

    it('returns 404 for a non-existent message', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'DELETE',
        url: `/api/requests/${req1.id}/messages/00000000-0000-0000-0000-000000000000`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 on the 31st send within 60 seconds', async () => {
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: false,
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(customer.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        for (let i = 0; i < 30; i++) {
          const ok = await app.inject({
            method: 'POST',
            url: `/api/requests/${req1.id}/messages`,
            headers: { cookie, 'content-type': 'application/json' },
            payload: { content: `m${i}` },
          });
          expect(ok.statusCode).toBe(201);
        }

        const limited = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'too many' },
        });
        expect(limited.statusCode).toBe(429);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });
  });
});
