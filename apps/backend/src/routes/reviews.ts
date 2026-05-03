import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { writeAudit } from '../services/audit.js';

export interface ReviewRouteDeps {
  prisma: PrismaClient;
}

interface CreateBody {
  requestId?: string;
  rating?: number;
  comment?: string;
}

export function registerReviewRoutes(app: FastifyInstance, deps: ReviewRouteDeps): void {
  app.get<{ Querystring: { include_unapproved?: string } }>(
    '/api/reviews',
    { preHandler: app.requireAuth },
    async (req) => {
      const isAdmin = req.user!.role === 'admin';
      const includeUnapproved = req.query.include_unapproved === '1' && isAdmin;
      const where: Prisma.ReviewWhereInput = {
        deletedAt: null,
        ...(includeUnapproved ? {} : { approved: true }),
      };
      const reviews = await deps.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true } },
          request: { select: { id: true, scheduledFor: true } },
        },
      });
      return { data: reviews };
    },
  );

  app.post<{ Body: CreateBody }>(
    '/api/reviews',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const body = req.body ?? {};
      if (!body.requestId || typeof body.requestId !== 'string') {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'requestId is required' } });
      }
      if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'rating must be an integer 1-5' } });
      }
      if (!body.comment || typeof body.comment !== 'string' || body.comment.trim() === '') {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'comment is required' } });
      }
      const r = await deps.prisma.request.findUnique({ where: { id: body.requestId } });
      if (!r || r.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
      }
      if (r.userId !== req.user!.id) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Can only review your own requests' } });
      }
      if (r.status !== 'completed') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Request must be completed before review' } });
      }
      const existing = await deps.prisma.review.findFirst({
        where: { userId: req.user!.id, requestId: r.id, deletedAt: null },
      });
      if (existing) {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Review already exists for this request' } });
      }
      const created = await deps.prisma.review.create({
        data: {
          userId: req.user!.id,
          requestId: r.id,
          rating: body.rating,
          comment: body.comment.trim(),
        },
      });
      reply.code(201);
      return { data: created };
    },
  );

  const adminHook = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (reply.sent) return;
    await app.requireAdmin(req, reply);
  };

  app.post<{ Params: { id: string } }>(
    '/api/admin/reviews/:id/approve',
    { preHandler: adminHook },
    async (req, reply) => {
      const review = await deps.prisma.review.findUnique({ where: { id: req.params.id } });
      if (!review || review.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
      }
      const updated = await deps.prisma.review.update({
        where: { id: review.id },
        data: { approved: true, approvedAt: new Date() },
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Review',
        entityId: review.id,
        action: 'approve',
      });
      return { data: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/admin/reviews/:id',
    { preHandler: adminHook },
    async (req, reply) => {
      const review = await deps.prisma.review.findUnique({ where: { id: req.params.id } });
      if (!review || review.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Review not found' } });
      }
      await deps.prisma.review.update({
        where: { id: review.id },
        data: { deletedAt: new Date() },
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Review',
        entityId: review.id,
        action: 'delete',
      });
      return { data: { ok: true } };
    },
  );
}
