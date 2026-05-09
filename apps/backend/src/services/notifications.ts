/**
 * Cross-channel notification dispatcher. Today wires email; push notifications
 * plug in here next phase by adding `pushService` to NotificationChannels and
 * dispatching alongside email in the same trigger functions.
 */

import type { PrismaClient } from '@prisma/client';
import type { Mailer } from './mailer.js';
import type { PushService } from './push.js';

export interface NotificationChannels {
  mailer?: Mailer;
  push?: PushService;
}

export type NotifyAudience = 'owners' | 'customer';

interface RequestForNotify {
  id: string;
  orderNumber: number;
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
    `Order #${r.orderNumber}`,
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

  // Email channel
  if (channels.mailer) {
    const recipients = await ownerEmails(prisma);
    if (recipients.length > 0) {
      const subject = `New request #${r.orderNumber} from ${r.contactName}`;
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
        subject: `We received your Velvet Scoop request #${r.orderNumber}`,
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

  // Push channel (owners only — customer is unauth-style flow without browser context yet)
  if (channels.push) {
    try {
      await channels.push.sendToOwners({
        title: `New Velvet Scoop order #${r.orderNumber}`,
        body: `${r.contactName} — $${r.total.toString()}`,
        url: '/admin',
      });
    } catch (err) {
      log?.(err, 'owner push failed');
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
    accepted: `Your Velvet Scoop request #${r.orderNumber} is confirmed`,
    completed: `Your Velvet Scoop request #${r.orderNumber} is ready`,
    cancelled: `Your Velvet Scoop request #${r.orderNumber} was cancelled`,
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
            subject: `Cancelled: request #${r.orderNumber} from ${r.contactName}`,
            text: [`A request was cancelled.`, ``, fmtBase(r)].join('\n'),
          });
        } catch (err) {
          log?.(err, 'owner cancel email failed');
        }
      }
    }
  }

  // Push channel — push to the customer (if they're a signed-in member with a
  // subscription on this device) and to owners on cancel.
  if (channels.push) {
    const customer = await prisma.user.findFirst({
      where: { email: r.contactEmail },
      select: { id: true },
    });
    if (customer) {
      try {
        await channels.push.sendToUser(customer.id, {
          title: subjects[status],
          body: intros[status],
          url: '/requests',
        });
      } catch (err) {
        log?.(err, 'customer push failed');
      }
    }
    if (status === 'cancelled') {
      try {
        await channels.push.sendToOwners({
          title: `Order #${r.orderNumber} cancelled: ${r.contactName}`,
          body: `$${r.total.toString()} — see admin`,
          url: '/admin',
        });
      } catch (err) {
        log?.(err, 'owner cancel push failed');
      }
    }
  }
}

interface MessageForNotify {
  id: string;
  content: string;
  sender: { id: string; displayName: string };
  request: {
    id: string;
    userId: string;
    orderNumber: number;
    contactName: string;
  };
}

async function loadMessage(
  prisma: PrismaClient,
  messageId: string,
): Promise<MessageForNotify | null> {
  const m = await prisma.requestMessage.findUnique({
    where: { id: messageId },
    include: {
      sender: { select: { id: true, displayName: true } },
      request: { select: { id: true, userId: true, orderNumber: true, contactName: true } },
    },
  });
  if (!m) return null;
  return {
    id: m.id,
    content: m.content,
    sender: m.sender,
    request: m.request,
  };
}

function snippet(s: string): string {
  const trimmed = s.trim();
  return trimmed.length <= 80 ? trimmed : `${trimmed.slice(0, 77)}…`;
}

export async function notifyMessage(
  prisma: PrismaClient,
  channels: NotificationChannels,
  messageId: string,
  log?: (err: unknown, msg: string) => void,
): Promise<void> {
  const m = await loadMessage(prisma, messageId);
  if (!m) return;
  if (!channels.push) return;

  const senderIsCustomer = m.sender.id === m.request.userId;
  if (senderIsCustomer) {
    try {
      await channels.push.sendToOwners({
        title: `Message on order #${m.request.orderNumber}`,
        body: `${m.request.contactName}: ${snippet(m.content)}`,
        url: '/requests',
      });
    } catch (err) {
      log?.(err, 'owner message push failed');
    }
  } else {
    try {
      await channels.push.sendToUser(m.request.userId, {
        title: `Order #${m.request.orderNumber} — reply from Velvet Scoop`,
        body: `${m.sender.displayName}: ${snippet(m.content)}`,
        url: '/requests',
      });
    } catch (err) {
      log?.(err, 'customer message push failed');
    }
  }
}
