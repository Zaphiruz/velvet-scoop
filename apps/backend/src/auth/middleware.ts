import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import type { SessionStore } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthMiddlewareDeps {
  prisma: PrismaClient;
  sessionStore: SessionStore;
  sessionCookieName: string;
}

function readSessionCookie(req: FastifyRequest, cookieName: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, value] = part.trim().split('=');
    if (name === cookieName && value !== undefined) return value;
  }
  return undefined;
}

export function makeRequireAuth(deps: AuthMiddlewareDeps) {
  return async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const sid = readSessionCookie(req, deps.sessionCookieName);
    if (!sid) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'No session' } });
      return;
    }
    const payload = await deps.sessionStore.get(sid);
    if (!payload) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });
      return;
    }
    const user = await deps.prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.deletedAt) {
      await deps.sessionStore.destroy(sid);
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }
    if (user.banned) {
      await deps.sessionStore.destroy(sid);
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'User is banned' } });
      return;
    }
    req.user = user;
  };
}

export function makeRequireAdmin() {
  return async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user) {
      reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'No user on request' } });
      return;
    }
    if (req.user.role !== 'admin') {
      reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Admin required' } });
      return;
    }
  };
}
