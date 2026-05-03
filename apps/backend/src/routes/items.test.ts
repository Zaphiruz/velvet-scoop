import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../test/helpers/db.js';
import { createTestApp, type TestAppHandle } from '../test/helpers/test-app.js';

describe('items routes', () => {
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

  it('GET /api/items lists only active items', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    await h.prisma.item.create({
      data: { name: 'Vanilla', description: 'classic', cost: '4.50', active: true },
    });
    await h.prisma.item.create({
      data: { name: 'Retired Sorbet', description: 'gone', cost: '5.00', active: false },
    });
    const res = await h.app.inject({ method: 'GET', url: '/api/items', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const items = res.json().data;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Vanilla');
  });

  it('admin can list inactive items via include_inactive=1', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    await h.prisma.item.create({
      data: { name: 'Vanilla', description: 'classic', cost: '4.50', active: true },
    });
    await h.prisma.item.create({
      data: { name: 'Retired', description: 'gone', cost: '5.00', active: false },
    });
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/items?include_inactive=1',
      headers: { cookie },
    });
    expect(res.json().data).toHaveLength(2);
  });

  it('POST /api/items requires admin', async () => {
    const member = await h.createUser({ role: 'member' });
    const cookie = await h.cookieFor(member.id);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { name: 'X', description: 'y', cost: 1 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/items creates an item and writes audit log', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { name: 'Vanilla', description: 'classic', cost: 4.5 },
    });
    expect(res.statusCode).toBe(201);
    const created = res.json().data;
    expect(created.name).toBe('Vanilla');
    const log = await h.prisma.auditLog.findFirst({
      where: { entityType: 'Item', entityId: created.id, action: 'create' },
    });
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe(admin.id);
  });

  it('POST /api/items rejects negative cost', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { name: 'X', description: 'y', cost: -1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE soft-deletes and hides from listing', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    const item = await h.prisma.item.create({
      data: { name: 'X', description: 'y', cost: '1', active: true },
    });
    const del = await h.app.inject({
      method: 'DELETE',
      url: `/api/items/${item.id}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(200);
    const list = await h.app.inject({ method: 'GET', url: '/api/items', headers: { cookie } });
    expect(list.json().data).toHaveLength(0);
    const fresh = await h.prisma.item.findUnique({ where: { id: item.id } });
    expect(fresh!.deletedAt).not.toBeNull();
    expect(fresh!.active).toBe(false);
  });
});
