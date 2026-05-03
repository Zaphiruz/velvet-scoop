import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export interface MessageRouteDeps {
  prisma: PrismaClient;
}

interface SendBody {
  recipientId?: string;
  content?: string;
}

export function registerMessageRoutes(app: FastifyInstance, deps: MessageRouteDeps): void {
  app.get<{ Querystring: { box?: 'inbox' | 'sent' } }>(
    '/api/messages',
    { preHandler: app.requireAuth },
    async (req) => {
      const box = req.query.box ?? 'inbox';
      const where =
        box === 'sent'
          ? { senderId: req.user!.id, deletedAt: null }
          : { recipientId: req.user!.id, deletedAt: null };
      const messages = await deps.prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, displayName: true } },
          recipient: { select: { id: true, displayName: true } },
        },
      });
      return { data: messages };
    },
  );

  app.post<{ Body: SendBody }>(
    '/api/messages',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (req.user!.muted) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'You are muted' } });
      }
      const body = req.body ?? {};
      if (!body.recipientId || typeof body.recipientId !== 'string') {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'recipientId is required' } });
      }
      if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'content is required' } });
      }
      if (body.recipientId === req.user!.id) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'Cannot message yourself' } });
      }
      const recipient = await deps.prisma.user.findUnique({ where: { id: body.recipientId } });
      if (!recipient || recipient.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Recipient not found' } });
      }
      const created = await deps.prisma.message.create({
        data: {
          senderId: req.user!.id,
          recipientId: recipient.id,
          content: body.content.trim(),
        },
      });
      reply.code(201);
      return { data: created };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/messages/:id/read',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const m = await deps.prisma.message.findUnique({ where: { id: req.params.id } });
      if (!m || m.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
      }
      if (m.recipientId !== req.user!.id) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not your message' } });
      }
      if (m.readAt) return { data: m };
      const updated = await deps.prisma.message.update({
        where: { id: m.id },
        data: { readAt: new Date() },
      });
      return { data: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/messages/:id',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const m = await deps.prisma.message.findUnique({ where: { id: req.params.id } });
      if (!m || m.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
      }
      const isParticipant = m.senderId === req.user!.id || m.recipientId === req.user!.id;
      if (!isParticipant && req.user!.role !== 'admin') {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not your message' } });
      }
      await deps.prisma.message.update({
        where: { id: m.id },
        data: { deletedAt: new Date() },
      });
      return { data: { ok: true } };
    },
  );
}
