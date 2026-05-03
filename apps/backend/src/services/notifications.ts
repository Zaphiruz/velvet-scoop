/**
 * Cross-channel notification dispatcher. Today wires email; push notifications
 * plug in here next phase by adding `pushService` to NotificationChannels and
 * dispatching alongside email in the same trigger functions.
 */

import type { PrismaClient } from '@prisma/client';
import type { Mailer } from './mailer.js';

export interface NotificationChannels {
  mailer?: Mailer;
}

export type NotifyAudience = 'owners' | 'customer';

interface RequestForNotify {
  id: string;
  total: { toString(): string } | string;
  scheduledFor: Date;
  contactName: string;
  contactEmail: string;
  contactNotes: string | null;
  status: string;
  items: Array<{ quantity: number; item: { name: string } | null }>;
}

async function loadRequest(
  prisma: PrismaClient,
  requestId: string,
): Promise<RequestForNotify | null> {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { items: { include: { item: { select: { name: true } } } } },
  });
  return r as RequestForNotify | null;
}

async function ownerEmails(prisma: PrismaClient): Promise<string[]> {
  const owners = await prisma.user.findMany({
    where: { isOwner: true, role: 'admin', deletedAt: null, banned: false },
    select: { email: true },
  });
  return owners.map((o) => o.email).filter((e): e is string => typeof e === 'string' && e !== '');
}

function fmtItems(r: RequestForNotify): string {
  return r.items
    .map((line) => `  ${line.quantity} × ${line.item?.name ?? 'unknown'}`)
    .join('\n');
}

function fmtBase(r: RequestForNotify): string {
  return [
    `Scheduled: ${new Date(r.scheduledFor).toLocaleString()}`,
    `Total: $${r.total.toString()}`,
    ``,
    `Items:`,
    fmtItems(r),
    ...(r.contactNotes ? [``, `Notes: ${r.contactNotes}`] : []),
  ].join('\n');
}

export async function notifyOrderArrived(
  prisma: PrismaClient,
  channels: NotificationChannels,
  requestId: string,
  log?: (err: unknown, msg: string) => void,
): Promise<void> {
  const r = await loadRequest(prisma, requestId);
  if (!r) return;

  if (channels.mailer) {
    const recipients = await ownerEmails(prisma);
    if (recipients.length > 0) {
      const subject = `New request from ${r.contactName}`;
      const text = [
        `A new request just came in.`,
        ``,
        `Customer: ${r.contactName} <${r.contactEmail}>`,
        fmtBase(r),
      ].join('\n');
      try {
        await channels.mailer.send({ to: recipients, subject, text });
      } catch (err) {
        log?.(err, 'owner email failed');
      }
    }

    // Customer confirmation
    try {
      await channels.mailer.send({
        to: r.contactEmail,
        subject: `We received your Velvet Scoop request`,
        text: [
          `Hi ${r.contactName},`,
          ``,
          `Thanks — we got your request and will be in touch shortly to confirm.`,
          ``,
          fmtBase(r),
        ].join('\n'),
      });
    } catch (err) {
      log?.(err, 'customer confirmation email failed');
    }
  }
}

export async function notifyOrderStatusChanged(
  prisma: PrismaClient,
  channels: NotificationChannels,
  requestId: string,
  status: 'accepted' | 'completed' | 'cancelled',
  log?: (err: unknown, msg: string) => void,
): Promise<void> {
  const r = await loadRequest(prisma, requestId);
  if (!r) return;

  const subjects: Record<typeof status, string> = {
    accepted: 'Your Velvet Scoop request is confirmed',
    completed: 'Your Velvet Scoop request is ready',
    cancelled: 'Your Velvet Scoop request was cancelled',
  };
  const intros: Record<typeof status, string> = {
    accepted: `Good news — we accepted your request and have you on the schedule.`,
    completed: `Your request is wrapped up. Thanks for ordering!`,
    cancelled: `Your request has been cancelled. Reach out if this was unexpected.`,
  };

  if (channels.mailer) {
    try {
      await channels.mailer.send({
        to: r.contactEmail,
        subject: subjects[status],
        text: [`Hi ${r.contactName},`, ``, intros[status], ``, fmtBase(r)].join('\n'),
      });
    } catch (err) {
      log?.(err, 'customer status email failed');
    }

    // Notify owners on cancel so they know not to hold inventory
    if (status === 'cancelled') {
      const recipients = await ownerEmails(prisma);
      if (recipients.length > 0) {
        try {
          await channels.mailer.send({
            to: recipients,
            subject: `Cancelled: request from ${r.contactName}`,
            text: [`A request was cancelled.`, ``, fmtBase(r)].join('\n'),
          });
        } catch (err) {
          log?.(err, 'owner cancel email failed');
        }
      }
    }
  }
}
