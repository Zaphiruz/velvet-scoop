import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { writeAudit } from '../services/audit.js';

export interface RequestRouteDeps {
  prisma: PrismaClient;
}

interface CreateBody {
  scheduledFor?: string;
  contactName?: string;
  contactEmail?: string;
  contactNotes?: string | null;
  items?: Array<{ itemId?: string; quantity?: number }>;
}

const requestInclude = {
  items: { include: { item: true } },
} as const;

export function registerRequestRoutes(app: FastifyInstance, deps: RequestRouteDeps): void {
  app.get('/api/requests', { preHandler: app.requireAuth }, async (req) => {
    const isAdmin = req.user!.role === 'admin';
    const where: Prisma.RequestWhereInput = {
      deletedAt: null,
      ...(isAdmin ? {} : { userId: req.user!.id }),
    };
    const requests = await deps.prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: requestInclude,
    });
    return { data: requests };
  });

  app.get<{ Params: { id: string } }>(
    '/api/requests/:id',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const r = await deps.prisma.request.findUnique({
        where: { id: req.params.id },
        include: requestInclude,
      });
      if (!r || r.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      }
      if (r.userId !== req.user!.id && req.user!.role !== 'admin') {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not your request' } });
      }
      return { data: r };
    },
  );

  app.post<{ Body: CreateBody }>('/api/requests', { preHandler: app.requireAuth }, async (req, reply) => {
    const body = req.body ?? {};
    if (!body.scheduledFor) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'scheduledFor is required' } });
    }
    const scheduledFor = new Date(body.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'scheduledFor must be a valid date' } });
    }
    if (!body.contactName || typeof body.contactName !== 'string') {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'contactName is required' } });
    }
    if (!body.contactEmail || typeof body.contactEmail !== 'string') {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'contactEmail is required' } });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'items must be a non-empty array' } });
    }
    const lines: Array<{ itemId: string; quantity: number }> = [];
    for (const line of body.items) {
      if (!line || typeof line.itemId !== 'string' || typeof line.quantity !== 'number' || line.quantity < 1) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'each item needs itemId and positive integer quantity' },
        });
      }
      lines.push({ itemId: line.itemId, quantity: Math.floor(line.quantity) });
    }
    const itemIds = [...new Set(lines.map((l) => l.itemId))];
    const items = await deps.prisma.item.findMany({
      where: { id: { in: itemIds }, deletedAt: null, active: true },
    });
    if (items.length !== itemIds.length) {
      return reply.code(400).send({
        error: { code: 'BAD_REQUEST', message: 'one or more items are unavailable' },
      });
    }
    const itemById = new Map(items.map((i) => [i.id, i]));
    let totalNum = 0;
    for (const line of lines) {
      const item = itemById.get(line.itemId)!;
      totalNum += Number(item.cost) * line.quantity;
    }
    const total = totalNum.toFixed(2);

    const created = await deps.prisma.request.create({
      data: {
        userId: req.user!.id,
        total,
        scheduledFor,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactNotes: body.contactNotes ?? null,
        items: { create: lines },
      },
      include: requestInclude,
    });
    reply.code(201);
    return { data: created };
  });

  const adminHook = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (reply.sent) return;
    await app.requireAdmin(req, reply);
  };

  app.post<{ Params: { id: string } }>(
    '/api/requests/:id/accept',
    { preHandler: adminHook },
    async (req, reply) => {
      const r = await deps.prisma.request.findUnique({ where: { id: req.params.id } });
      if (!r || r.deletedAt) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      if (r.status !== 'pending') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: `Cannot accept from status ${r.status}` } });
      }
      const updated = await deps.prisma.request.update({
        where: { id: r.id },
        data: { status: 'accepted', acceptedAt: new Date() },
        include: requestInclude,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Request',
        entityId: r.id,
        action: 'accept',
      });
      return { data: updated };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/requests/:id/complete',
    { preHandler: adminHook },
    async (req, reply) => {
      const r = await deps.prisma.request.findUnique({ where: { id: req.params.id } });
      if (!r || r.deletedAt) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      if (r.status !== 'accepted') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: `Cannot complete from status ${r.status}` } });
      }
      const updated = await deps.prisma.request.update({
        where: { id: r.id },
        data: { status: 'completed', completedAt: new Date() },
        include: requestInclude,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Request',
        entityId: r.id,
        action: 'complete',
      });
      return { data: updated };
    },
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/api/requests/:id/cancel',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const r = await deps.prisma.request.findUnique({ where: { id: req.params.id } });
      if (!r || r.deletedAt) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      const isOwner = r.userId === req.user!.id;
      const isAdmin = req.user!.role === 'admin';
      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not your request' } });
      }
      if (isOwner && !isAdmin && r.status !== 'pending') {
        return reply.code(409).send({
          error: { code: 'CONFLICT', message: 'Owners can only cancel pending requests' },
        });
      }
      if (r.status === 'cancelled' || r.status === 'completed') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: `Already ${r.status}` } });
      }
      const updated = await deps.prisma.request.update({
        where: { id: r.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
        include: requestInclude,
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Request',
        entityId: r.id,
        action: 'cancel',
        metadata: { reason: req.body?.reason ?? null, byAdmin: isAdmin && !isOwner },
      });
      return { data: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/requests/:id',
    { preHandler: adminHook },
    async (req, reply) => {
      const r = await deps.prisma.request.findUnique({ where: { id: req.params.id } });
      if (!r || r.deletedAt) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      await deps.prisma.request.update({
        where: { id: r.id },
        data: { deletedAt: new Date() },
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Request',
        entityId: r.id,
        action: 'delete',
      });
      return { data: { ok: true } };
    },
  );
}
