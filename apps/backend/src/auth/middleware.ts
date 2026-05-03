import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface RequireAuthDeps {
  prisma: PrismaClient;
}

// Phase 2 stub: identifies the caller via `x-user-id` header.
// Phase 3 replaces this with cookie sessions + Authentik OIDC.
export function makeRequireAuth(deps: RequireAuthDeps) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = req.headers['x-user-id'];
    if (typeof userId !== 'string' || userId === '') {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing x-user-id (auth stub)' } });
      return;
    }
    const user = await deps.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unknown user' } });
      return;
    }
    if (user.banned) {
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'User is banned' } });
      return;
    }
    req.user = user;
  };
}

export function makeRequireAdmin() {
  return async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
      return;
    }
    if (req.user.role !== 'admin') {
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin only' } });
      return;
    }
  };
}
