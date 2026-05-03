import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { makeRequireAdmin, makeRequireAuth } from './auth/middleware.js';
import { registerAuthRoutes } from './auth/routes.js';
import type { OidcClient } from './auth/oidc.js';
import type { RoleSyncConfig } from './auth/role-sync.js';
import type { SessionStore } from './auth/session.js';
import { registerUserRoutes } from './routes/users.js';
import { registerItemRoutes } from './routes/items.js';
import { registerRequestRoutes } from './routes/requests.js';
import { registerReviewRoutes } from './routes/reviews.js';
import { registerMessageRoutes } from './routes/messages.js';

export interface BuildAppOptions {
  logger?: boolean;
  prisma: PrismaClient;
  redis?: Redis;
  sessionStore: SessionStore;
  sessionCookieName?: string;
  sessionSecret?: string;
  sessionTtlSeconds?: number;
  cookieSecure?: boolean;
  oidcClient: OidcClient;
  authentikGroups: RoleSyncConfig;
  frontendOrigin?: string;
  /** Disable rate limiting (used in tests). */
  disableRateLimit?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  const cookieName = options.sessionCookieName ?? 'velvetscoop_sid';
  const cookieSecret = options.sessionSecret ?? 'dev-only-secret-change-me';
  const cookieSecure = options.cookieSecure ?? false;
  const sessionTtlSeconds = options.sessionTtlSeconds ?? 7 * 24 * 60 * 60;
  const frontendOrigin = options.frontendOrigin ?? 'http://localhost:5173';

  await app.register(cookie, { secret: cookieSecret });
  await app.register(cors, { origin: frontendOrigin, credentials: true });

  if (!options.disableRateLimit) {
    await app.register(rateLimit, {
      global: true,
      max: 300,
      timeWindow: '1 minute',
      allowList: (req) => req.url === '/health' || req.url === '/ready',
    });
  }

  app.decorate(
    'requireAuth',
    makeRequireAuth({
      prisma: options.prisma,
      sessionStore: options.sessionStore,
      sessionCookieName: cookieName,
    }),
  );
  app.decorate('requireAdmin', makeRequireAdmin());

  // Liveness — process is up. Cheap, no dependencies.
  app.get('/health', async () => ({ status: 'ok' }));

  // Readiness — process can serve traffic (DB + Redis reachable).
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, 'ok' | string> = {};
    try {
      await options.prisma.$queryRaw`SELECT 1`;
      checks['db'] = 'ok';
    } catch (err) {
      checks['db'] = err instanceof Error ? err.message : 'error';
    }
    if (options.redis) {
      try {
        const pong = await options.redis.ping();
        checks['redis'] = pong === 'PONG' ? 'ok' : pong;
      } catch (err) {
        checks['redis'] = err instanceof Error ? err.message : 'error';
      }
    }
    const ready = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ready ? 200 : 503).send({ status: ready ? 'ok' : 'degraded', checks });
  });

  registerAuthRoutes(app, {
    prisma: options.prisma,
    sessionStore: options.sessionStore,
    sessionCookieName: cookieName,
    sessionTtlSeconds,
    oidcClient: options.oidcClient,
    authentikGroups: options.authentikGroups,
    frontendOrigin,
    cookieSecure,
    rateLimitEnabled: !options.disableRateLimit,
  });

  registerUserRoutes(app, { prisma: options.prisma });
  registerItemRoutes(app, { prisma: options.prisma });
  registerRequestRoutes(app, { prisma: options.prisma });
  registerReviewRoutes(app, { prisma: options.prisma });
  registerMessageRoutes(app, { prisma: options.prisma });

  return app;
}
