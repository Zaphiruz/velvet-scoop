import webpush from 'web-push';
import type { PrismaClient } from '@prisma/client';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

export interface PushService {
  sendToUser(userId: string, payload: PushPayload): Promise<void>;
  sendToOwners(payload: PushPayload): Promise<void>;
  publicKey: string;
}

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  /** mailto:… or https:// URL identifying the application server. */
  subject: string;
}

export function createPushService(
  prisma: PrismaClient,
  cfg: PushConfig,
  log?: (err: unknown, msg: string) => void,
): PushService {
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);

  async function deliverOne(
    sub: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      // Best-effort liveness marker; ignore errors on this update.
      await prisma.pushSubscription
        .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        // Subscription is dead; clean it up.
        await prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => undefined);
        return;
      }
      log?.(err, 'web-push send failed');
    }
  }

  return {
    publicKey: cfg.publicKey,

    async sendToUser(userId, payload) {
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      await Promise.all(subs.map((s) => deliverOne(s, payload)));
    },

    async sendToOwners(payload) {
      const subs = await prisma.pushSubscription.findMany({
        where: {
          user: { isOwner: true, role: 'admin', deletedAt: null, banned: false },
        },
      });
      await Promise.all(subs.map((s) => deliverOne(s, payload)));
    },
  };
}
