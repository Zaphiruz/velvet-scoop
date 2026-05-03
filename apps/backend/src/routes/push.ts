import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export interface PushRouteDeps {
  prisma: PrismaClient;
  vapidPublicKey?: string;
}

export function registerPushRoutes(app: FastifyInstance, deps: PushRouteDeps): void {
  app.get('/api/push/vapid-public-key', async (_req, reply) => {
    if (!deps.vapidPublicKey) {
      return reply.code(503).send({
        error: { code: 'PUSH_NOT_CONFIGURED', message: 'Push notifications are not configured' },
      });
    }
    return { data: { publicKey: deps.vapidPublicKey } };
  });

  app.post<{
    Body: { endpoint?: string; p256dh?: string; auth?: string; userAgent?: string };
  }>(
    '/api/push/subscribe',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const body = req.body ?? {};
      if (
        !body.endpoint ||
        typeof body.endpoint !== 'string' ||
        !body.p256dh ||
        typeof body.p256dh !== 'string' ||
        !body.auth ||
        typeof body.auth !== 'string'
      ) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'endpoint, p256dh, and auth are required strings' },
        });
      }
      const sub = await deps.prisma.pushSubscription.upsert({
        where: { endpoint: body.endpoint },
        create: {
          userId: req.user!.id,
          endpoint: body.endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          userAgent: typeof body.userAgent === 'string' ? body.userAgent : null,
        },
        update: {
          userId: req.user!.id,
          p256dh: body.p256dh,
          auth: body.auth,
          userAgent: typeof body.userAgent === 'string' ? body.userAgent : null,
          lastUsedAt: new Date(),
        },
      });
      reply.code(201);
      return { data: { id: sub.id, endpoint: sub.endpoint } };
    },
  );

  app.delete<{ Body: { endpoint?: string } | undefined }>(
    '/api/push/subscribe',
    { preHandler: app.requireAuth },
    async (req) => {
      const endpoint = req.body?.endpoint;
      if (typeof endpoint === 'string') {
        await deps.prisma.pushSubscription.deleteMany({
          where: { userId: req.user!.id, endpoint },
        });
      } else {
        await deps.prisma.pushSubscription.deleteMany({ where: { userId: req.user!.id } });
      }
      return { data: { ok: true } };
    },
  );
}
