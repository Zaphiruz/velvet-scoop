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
});
