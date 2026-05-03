import type { PrismaClient, Prisma } from '@prisma/client';

export interface AuditEntry {
  actorId: string | null;
  entityType: 'User' | 'Item' | 'Request' | 'Review' | 'Message';
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    },
  });
}
