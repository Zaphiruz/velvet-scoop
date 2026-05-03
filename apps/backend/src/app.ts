import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { makeRequireAdmin, makeRequireAuth } from './auth/middleware.js';
import { registerUserRoutes } from './routes/users.js';
import { registerItemRoutes } from './routes/items.js';
import { registerRequestRoutes } from './routes/requests.js';
import { registerReviewRoutes } from './routes/reviews.js';
import { registerMessageRoutes } from './routes/messages.js';

export interface BuildAppOptions {
  logger?: boolean;
  prisma: PrismaClient;
  cookieSecret?: string;
  frontendOrigin?: string;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(cookie, { secret: options.cookieSecret ?? 'dev-only-secret-change-me' });
  await app.register(cors, {
    origin: options.frontendOrigin ?? 'http://localhost:5173',
    credentials: true,
  });

  app.decorate('requireAuth', makeRequireAuth({ prisma: options.prisma }));
  app.decorate('requireAdmin', makeRequireAdmin());

  app.get('/health', async () => ({ status: 'ok' }));

  registerUserRoutes(app, { prisma: options.prisma });
  registerItemRoutes(app, { prisma: options.prisma });
  registerRequestRoutes(app, { prisma: options.prisma });
  registerReviewRoutes(app, { prisma: options.prisma });
  registerMessageRoutes(app, { prisma: options.prisma });

  return app;
}
