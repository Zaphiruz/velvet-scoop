import { Redis } from 'ioredis';

let instance: Redis | undefined;

export function getRedis(url: string): Redis {
  if (!instance) {
    instance = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: true });
  }
  return instance;
}

export async function disconnectRedis(): Promise<void> {
  if (instance) {
    await instance.quit();
    instance = undefined;
  }
}
