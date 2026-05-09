import type { FastifyInstance, FastifyReply } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export interface RequestMessageRouteDeps {
  prisma: PrismaClient;
}

interface ParticipantContext {
  isCustomer: boolean;
  isOwner: boolean;
}

async function loadRequestForParticipant(
  prisma: PrismaClient,
  requestId: string,
  viewerId: string,
  viewerRole: string,
  viewerIsOwner: boolean,
  reply: FastifyReply,
): Promise<{ requestRow: { id: string; userId: string; status: string } | null; ctx: ParticipantContext } | null> {
  const requestRow = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, userId: true, status: true, deletedAt: true },
  });
  if (!requestRow || requestRow.deletedAt) {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Request not found' } });
    return null;
  }
  const isCustomer = requestRow.userId === viewerId;
  const isOwner = viewerRole === 'admin' && viewerIsOwner === true;
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
      const loaded = await loadRequestForParticipant(
        deps.prisma,
        req.params.id,
        viewer.id,
        viewer.role,
        viewer.isOwner ?? false,
        reply,
      );
      if (!loaded) return reply;

      const messages = await deps.prisma.requestMessage.findMany({
        where: { requestId: loaded.requestRow!.id },
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
}
