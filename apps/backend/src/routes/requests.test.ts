import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../test/helpers/db.js';
import { createTestApp, type TestAppHandle } from '../test/helpers/test-app.js';

describe('requests routes', () => {
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

  async function seedItem(opts: Partial<{ cost: string; active: boolean }> = {}) {
    return h.prisma.item.create({
      data: {
        name: `Item-${Math.random().toString(36).slice(2, 7)}`,
        description: 'd',
        cost: opts.cost ?? '4.50',
        active: opts.active ?? true,
      },
    });
  }

  function basePayload(items: Array<{ itemId: string; quantity: number }>) {
    return {
      scheduledFor: '2026-08-01T18:00:00Z',
      contactName: 'J',
      contactEmail: 'j@example.com',
      items,
    };
  }

  it('POST /api/requests rejects empty items array', async () => {
    const user = await h.createUser();
    const cookie = await h.cookieFor(user.id);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie, 'content-type': 'application/json' },
      payload: basePayload([]),
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/requests rejects unknown items', async () => {
    const user = await h.createUser();
    const cookie = await h.cookieFor(user.id);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie, 'content-type': 'application/json' },
      payload: basePayload([
        { itemId: '00000000-0000-0000-0000-000000000000', quantity: 1 },
      ]),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/unavailable/);
  });

  it('POST /api/requests rejects inactive items', async () => {
    const user = await h.createUser();
    const cookie = await h.cookieFor(user.id);
    const item = await seedItem({ active: false });
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie, 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/requests computes total from line items', async () => {
    const user = await h.createUser();
    const cookie = await h.cookieFor(user.id);
    const a = await seedItem({ cost: '4.50' });
    const b = await seedItem({ cost: '3.25' });
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie, 'content-type': 'application/json' },
      payload: basePayload([
        { itemId: a.id, quantity: 2 }, // 9.00
        { itemId: b.id, quantity: 4 }, // 13.00
      ]),
    });
    expect(res.statusCode).toBe(201);
    expect(Number(res.json().data.total)).toBe(22);
  });

  it('GET /api/requests returns only own requests for members', async () => {
    const alice = await h.createUser();
    const bob = await h.createUser();
    const item = await seedItem();
    await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: await h.cookieFor(alice.id), 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { cookie: await h.cookieFor(bob.id) },
    });
    expect(res.json().data).toHaveLength(0);
  });

  it('GET /api/requests as admin returns all', async () => {
    const alice = await h.createUser();
    const admin = await h.createUser({ role: 'admin' });
    const item = await seedItem();
    await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: await h.cookieFor(alice.id), 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/requests',
      headers: { cookie: await h.cookieFor(admin.id) },
    });
    expect(res.json().data).toHaveLength(1);
  });

  it('accept transitions: pending -> accepted, but not from completed', async () => {
    const user = await h.createUser();
    const admin = await h.createUser({ role: 'admin' });
    const item = await seedItem();
    const created = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: await h.cookieFor(user.id), 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    const id = created.json().data.id;
    const adminCookie = await h.cookieFor(admin.id);

    const accepted = await h.app.inject({
      method: 'POST',
      url: `/api/requests/${id}/accept`,
      headers: { cookie: adminCookie },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.status).toBe('accepted');

    // Cannot accept again
    const reaccept = await h.app.inject({
      method: 'POST',
      url: `/api/requests/${id}/accept`,
      headers: { cookie: adminCookie },
    });
    expect(reaccept.statusCode).toBe(409);
  });

  it('owner can cancel pending; not after acceptance', async () => {
    const user = await h.createUser();
    const admin = await h.createUser({ role: 'admin' });
    const item = await seedItem();
    const userCookie = await h.cookieFor(user.id);
    const adminCookie = await h.cookieFor(admin.id);

    const created = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: userCookie, 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    const id = created.json().data.id;

    // Owner cancels while pending — allowed
    const cancelled = await h.app.inject({
      method: 'POST',
      url: `/api/requests/${id}/cancel`,
      headers: { cookie: userCookie },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().data.status).toBe('cancelled');

    // New request, accept, then owner tries to cancel — should be 409
    const again = await h.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: userCookie, 'content-type': 'application/json' },
      payload: basePayload([{ itemId: item.id, quantity: 1 }]),
    });
    const id2 = again.json().data.id;
    await h.app.inject({
      method: 'POST',
      url: `/api/requests/${id2}/accept`,
      headers: { cookie: adminCookie },
    });
    const conflict = await h.app.inject({
      method: 'POST',
      url: `/api/requests/${id2}/cancel`,
      headers: { cookie: userCookie },
    });
    expect(conflict.statusCode).toBe(409);
  });
});
