import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { notifyMessage, type NotificationChannels } from '../services/notifications.js';

export interface RequestMessageRouteDeps {
  prisma: PrismaClient;
  channels?: NotificationChannels;
}

interface ParticipantContext {
  isCustomer: boolean;
  isOwner: boolean;
}

async function loadRequestForParticipant(
  prisma: PrismaClient,
  requestId: string,
  viewer: { id: string; role: string; isOwner: boolean },
  reply: FastifyReply,
): Promise<{ requestRow: { id: string; userId: string; status: string }; ctx: ParticipantContext } | null> {
  const requestRow = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true, deletedAt: true },
  });
  if (!requestRow || requestRow.deletedAt) {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return null;
  }
  const isCustomer = requestRow.userId === viewer.id;
  const isOwner = viewer.role === 'admin' && viewer.isOwner === true;
  if (!isCustomer && !isOwner) {
    reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not a participant on this thread' } });
    return null;
  }
  return { requestRow: { id: requestRow.id, userId: requestRow.userId, status: requestRow.status }, ctx: { isCustomer, isOwner } };
}

export function registerRequestMessageRoutes(app: FastifyInstance, deps: RequestMessageRouteDeps): void {
  app.get<{ Params: { id: string } }>(
    '/api/requests/:id/messages',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const viewer = req.user!;
      const loaded = await loadRequestForParticipant(deps.prisma, req.params.id, viewer, reply);
      if (!loaded) return reply;

      const messages = await deps.prisma.requestMessage.findMany({
        where: { requestId: loaded.requestRow.id },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, displayName: true } } },
      });
      const data = messages.map((m) => ({
        id: m.id,
        requestId: m.requestId,
        senderId: m.senderId,
        sender: m.sender,
        content: m.deletedAt ? null : m.content,
        deleted: m.deletedAt !== null,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      }));
      return { data };
    },
  );

  app.post<{ Params: { id: string }; Body: { content?: unknown } }>(
    '/api/requests/:id/messages',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const viewer = req.user!;
      const loaded = await loadRequestForParticipant(deps.prisma, req.params.id, viewer, reply);
      if (!loaded) return reply;

      const status = loaded.requestRow.status;
      if (status !== 'pending' && status !== 'accepted') {
        return reply.code(409).send({
          error: { code: 'THREAD_CLOSED', message: 'This order is closed; messaging is locked' },
        });
      }

      const raw = (req.body ?? {}).content;
      if (typeof raw !== 'string') {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content must be a string' },
        });
      }
      const content = raw.trim();
      if (content.length === 0) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content is required' },
        });
      }
      if (content.length > 4000) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content must be 4000 characters or fewer' },
        });
      }

      const created = await deps.prisma.requestMessage.create({
        data: {
          requestId: loaded.requestRow.id,
          senderId: viewer.id,
          content,
        },
        include: { sender: { select: { id: true, displayName: true } } },
      });

      if (deps.channels) {
        void notifyMessage(deps.prisma, deps.channels, created.id, (err, msg) =>
          req.log.warn({ err }, msg),
        );
      }

      reply.code(201);
      return {
        data: {
          id: created.id,
          requestId: created.requestId,
          senderId: created.senderId,
          sender: created.sender,
          content: created.content,
          deleted: false,
          readAt: null,
          createdAt: created.createdAt.toISOString(),
        },
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/requests/:id/messages/read',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const viewer = req.user!;
      const loaded = await loadRequestForParticipant(deps.prisma, req.params.id, viewer, reply);
      if (!loaded) return reply;

      const result = await deps.prisma.requestMessage.updateMany({
        where: {
          requestId: loaded.requestRow.id,
          senderId: { not: viewer.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { data: { updated: result.count } };
    },
  );
}
