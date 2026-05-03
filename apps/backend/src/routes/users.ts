import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { writeAudit } from '../services/audit.js';

export interface UserRouteDeps {
  prisma: PrismaClient;
}

const userPublic = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  muted: true,
  banned: true,
  createdAt: true,
} as const;

export function registerUserRoutes(app: FastifyInstance, deps: UserRouteDeps): void {
  app.get('/api/users/me', { preHandler: app.requireAuth }, async (req) => {
    return { data: req.user };
  });

  app.patch<{ Body: { displayName?: string } }>(
    '/api/users/me',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const { displayName } = req.body ?? {};
      if (displayName !== undefined && (typeof displayName !== 'string' || displayName.trim() === '')) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'displayName must be a non-empty string' },
        });
      }
      const updated = await deps.prisma.user.update({
        where: { id: req.user!.id },
        data: { ...(displayName ? { displayName: displayName.trim() } : {}) },
        select: userPublic,
      });
      return { data: updated };
    },
  );

  const adminHook = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (reply.sent) return;
    await app.requireAdmin(req, reply);
  };

  app.get('/api/admin/users', { preHandler: adminHook }, async () => {
    const users = await deps.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: userPublic,
    });
    return { data: users };
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/admin/users/:id/ban',
    { preHandler: adminHook },
    async (req, reply) => {
      const target = await deps.prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      const updated = await deps.prisma.user.update({
        where: { id: target.id },
        data: { banned: true, bannedAt: new Date() },
        select: userPublic,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'User',
        entityId: target.id,
        action: 'ban',
        metadata: { reason: req.body?.reason ?? null },
      });
      return { data: updated };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/unban',
    { preHandler: adminHook },
    async (req, reply) => {
      const target = await deps.prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      const updated = await deps.prisma.user.update({
        where: { id: target.id },
        data: { banned: false, bannedAt: null },
        select: userPublic,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'User',
        entityId: target.id,
        action: 'unban',
      });
      return { data: updated };
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/admin/users/:id/mute',
    { preHandler: adminHook },
    async (req, reply) => {
      const target = await deps.prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      const updated = await deps.prisma.user.update({
        where: { id: target.id },
        data: { muted: true, mutedAt: new Date() },
        select: userPublic,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'User',
        entityId: target.id,
        action: 'mute',
        metadata: { reason: req.body?.reason ?? null },
      });
      return { data: updated };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/unmute',
    { preHandler: adminHook },
    async (req, reply) => {
      const target = await deps.prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
      const updated = await deps.prisma.user.update({
        where: { id: target.id },
        data: { muted: false, mutedAt: null },
        select: userPublic,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'User',
        entityId: target.id,
        action: 'unmute',
      });
      return { data: updated };
    },
  );
}
