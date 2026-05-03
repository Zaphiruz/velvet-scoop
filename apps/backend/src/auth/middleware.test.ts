import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../test/helpers/db.js';
import { createTestApp, TEST_COOKIE_NAME, type TestAppHandle } from '../test/helpers/test-app.js';

describe('requireAuth middleware', () => {
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

  it('returns 401 when no session cookie is present', async () => {
    const res = await h.app.inject({ method: 'GET', url: '/api/items' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
  });

  it('returns 401 with an invalid session id', async () => {
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { cookie: `${TEST_COOKIE_NAME}=does-not-exist` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Invalid session');
  });

  it('resolves the user when a valid session exists', async () => {
    const user = await h.createUser({ displayName: 'Alice' });
    const cookie = await h.cookieFor(user.id);
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(user.id);
    expect(res.json().data.displayName).toBe('Alice');
  });

  it('returns 403 and destroys session for a banned user', async () => {
    const user = await h.createUser({ banned: true });
    const cookie = await h.cookieFor(user.id);
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('clears session for a soft-deleted user', async () => {
    const user = await h.createUser();
    await h.prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
    const cookie = await h.cookieFor(user.id);
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('requireAdmin middleware', () => {
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

  it('rejects member-role users on admin-only endpoints', async () => {
    const member = await h.createUser({ role: 'member' });
    const cookie = await h.cookieFor(member.id);
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('allows admin-role users', async () => {
    const admin = await h.createUser({ role: 'admin' });
    const cookie = await h.cookieFor(admin.id);
    const res = await h.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
  });
});
