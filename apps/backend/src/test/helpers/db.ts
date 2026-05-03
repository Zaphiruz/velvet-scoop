import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env['DATABASE_URL'] ??
            'postgres://velvetscoop:velvetscoop@localhost:5433/velvetscoop_test',
        },
      },
    });
  }
  return client;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}

const ALL_TABLES = [
  'feedback_submissions',
  'audit_logs',
  'reviews',
  'request_items',
  'requests',
  'messages',
  'items',
  'users',
];

export async function resetDatabase(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
  );
}
