import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
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
  sessionStore: SessionStore;
  sessionCookieName?: string;
  sessionSecret?: string;
  sessionTtlSeconds?: number;
  cookieSecure?: boolean;
  oidcClient: OidcClient;
  authentikGroups: RoleSyncConfig;
  frontendOrigin?: string;
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

  app.decorate(
    'requireAuth',
    makeRequireAuth({
      prisma: options.prisma,
      sessionStore: options.sessionStore,
      sessionCookieName: cookieName,
    }),
  );
  app.decorate('requireAdmin', makeRequireAdmin());

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, {
    prisma: options.prisma,
    sessionStore: options.sessionStore,
    sessionCookieName: cookieName,
    sessionTtlSeconds,
    oidcClient: options.oidcClient,
    authentikGroups: options.authentikGroups,
    frontendOrigin,
    cookieSecure,
  });

  registerUserRoutes(app, { prisma: options.prisma });
  registerItemRoutes(app, { prisma: options.prisma });
  registerRequestRoutes(app, { prisma: options.prisma });
  registerReviewRoutes(app, { prisma: options.prisma });
  registerMessageRoutes(app, { prisma: options.prisma });

  return app;
}
