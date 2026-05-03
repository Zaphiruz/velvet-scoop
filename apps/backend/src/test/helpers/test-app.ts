import type { FastifyInstance } from 'fastify';
import { Redis } from 'ioredis';
import { PrismaClient, UserRole } from '@prisma/client';
import { buildApp } from '../../app.js';
import { createSessionStore, type SessionStore } from '../../auth/session.js';
import type { OidcClient, OidcUserinfo } from '../../auth/oidc.js';

export const TEST_COOKIE_NAME = 'velvetscoop_sid_test';

export class FakeOidcClient implements OidcClient {
  userinfo: OidcUserinfo = {
    sub: 'sub-0',
    email: 'fake@example.com',
    name: 'Fake',
    groups: ['velvet-scoop-users'],
  };

  authorizationUrl() {
    return {
      url: 'https://auth.example/authorize',
      state: 'state-0',
      nonce: 'nonce-0',
      codeVerifier: 'cv-0',
    };
  }
  async exchange() {
    return this.userinfo;
  }
  endSessionUrl() {
    return 'https://auth.example/logout';
  }
}

interface CreateUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  authentikSub: string | null;
  banned: boolean;
  muted: boolean;
}

export interface TestAppHandle {
  app: FastifyInstance;
  prisma: PrismaClient;
  redis: Redis;
  sessionStore: SessionStore;
  fakeOidc: FakeOidcClient;
  close(): Promise<void>;
  cookieFor(userId: string): Promise<string>;
  createUser(opts?: Partial<CreateUserInput>): Promise<Awaited<ReturnType<PrismaClient['user']['create']>>>;
}

let uniqCounter = 0;

export async function createTestApp(): Promise<TestAppHandle> {
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
  });
  await app.ready();

  return {
    app,
    prisma,
    redis,
    sessionStore,
    fakeOidc,
    async close() {
      await app.close();
      await redis.quit();
      await prisma.$disconnect();
    },
    async cookieFor(userId: string) {
      const sid = await sessionStore.create(userId);
      return `${TEST_COOKIE_NAME}=${sid}`;
    },
    async createUser(opts = {}) {
      uniqCounter++;
      return prisma.user.create({
        data: {
          authentikSub: opts.authentikSub ?? `sub-${Date.now()}-${uniqCounter}`,
          email: opts.email ?? `u${uniqCounter}@example.com`,
          displayName: opts.displayName ?? `User ${uniqCounter}`,
          role: opts.role ?? UserRole.member,
          banned: opts.banned ?? false,
          muted: opts.muted ?? false,
        },
      });
    },
  };
}
