import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';

export interface SessionPayload {
  userId: string;
}

export interface SessionStore {
  create(userId: string): Promise<string>;
  get(sessionId: string): Promise<SessionPayload | null>;
  destroy(sessionId: string): Promise<void>;
}

export interface SessionStoreOptions {
  ttlSeconds: number;
  keyPrefix?: string;
}

const DEFAULT_PREFIX = 'sess:';

export function createSessionStore(redis: Redis, options: SessionStoreOptions): SessionStore {
  const prefix = options.keyPrefix ?? DEFAULT_PREFIX;

  return {
    async create(userId) {
      const id = randomUUID();
      const payload: SessionPayload = { userId };
      await redis.set(`${prefix}${id}`, JSON.stringify(payload), 'EX', options.ttlSeconds);
      return id;
    },

    async get(sessionId) {
      const raw = await redis.get(`${prefix}${sessionId}`);
      if (raw === null) return null;
      return JSON.parse(raw) as SessionPayload;
    },

    async destroy(sessionId) {
      await redis.del(`${prefix}${sessionId}`);
    },
  };
}
