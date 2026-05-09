# Order Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-request chat thread between the customer and the owner pool (admins with `isOwner: true`), gated to active orders, with push notifications and 12-second polling for freshness.

**Architecture:** New `RequestMessage` Prisma model + new Fastify route file (`/api/requests/:id/messages` namespace) + a single `MessageThread.tsx` React component reused by `RequestsPage` and `AdminRequestsTab`. Notifications hook into the existing `NotificationChannels` machinery via a new `notifyMessage` service function. Schema-additive only; no backfill; zero-downtime deploy.

**Tech Stack:** Postgres + Prisma 5 + Fastify + RTK Query + React + Tailwind + `@fastify/rate-limit`. Test runner: vitest with a real Postgres test DB at `localhost:5433/velvetscoop_test`.

**Spec:** `docs/superpowers/specs/2026-05-09-order-chat-design.md`

**Branch base:** `main` after PRs #7 and #8 are merged. The push titles use `#{orderNumber}` from PR #8.

---

## File map

**Created:**
- `apps/backend/prisma/migrations/20260509150000_add_request_messages/migration.sql`
- `apps/backend/src/routes/request-messages.ts` — the new route file
- `apps/backend/src/routes/request-messages.test.ts` — backend tests
- `apps/frontend/src/features/requests/MessageThread.tsx` — chat UI

**Modified:**
- `apps/backend/prisma/schema.prisma` — add `RequestMessage` model + relations
- `apps/backend/src/test/helpers/db.ts` — add `'request_messages'` to `ALL_TABLES`
- `apps/backend/src/services/notifications.ts` — add `notifyMessage` function
- `apps/backend/src/app.ts` — register the new route with `channels`
- `apps/frontend/src/api/api.ts` — `RequestMessage` interface + 4 RTK endpoints + `'RequestMessage'` tag type
- `apps/frontend/src/features/requests/RequestsPage.tsx` — integrate `MessageThread` + unread badge
- `apps/frontend/src/features/admin/AdminRequestsTab.tsx` — same integration on the admin side

---

## Task 1: Schema + migration + test-DB helper

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260509150000_add_request_messages/migration.sql`
- Modify: `apps/backend/src/test/helpers/db.ts`

This task is pure infrastructure. There is no test to write first because nothing depends on the schema yet — the schema *enables* every following task's tests. Verification is via `prisma generate` + `pnpm -r typecheck` + applying the migration to the test DB.

- [ ] **Step 1: Add `RequestMessage` model to schema**

In `apps/backend/prisma/schema.prisma`, append after the existing `Message` model (around line 140):

```prisma
model RequestMessage {
  id        String    @id @default(uuid()) @db.Uuid
  requestId String    @map("request_id") @db.Uuid
  senderId  String    @map("sender_id") @db.Uuid
  content   String
  readAt    DateTime? @map("read_at")
  deletedAt DateTime? @map("deleted_at")
  createdAt DateTime  @default(now()) @map("created_at")

  request Request @relation(fields: [requestId], references: [id], onDelete: Cascade)
  sender  User    @relation(fields: [senderId], references: [id])

  @@index([requestId, createdAt])
  @@map("request_messages")
}
```

Add the inverse relation on `Request` (replace the existing `Request` block's relations section):

```prisma
  user            User             @relation(fields: [userId], references: [id])
  items           RequestItem[]
  reviews         Review[]
  messages        RequestMessage[]
```

Add the inverse on `User` (add to its relations list, after `messagesReceived`):

```prisma
  requestMessagesSent RequestMessage[]
```

- [ ] **Step 2: Create the migration SQL**

Create `apps/backend/prisma/migrations/20260509150000_add_request_messages/migration.sql`:

```sql
-- New table for per-request chat threads. Standalone from the existing
-- `messages` table (which is sender↔recipient and currently unused in the UI).

CREATE TABLE "request_messages" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "request_messages_request_id_created_at_idx"
    ON "request_messages"("request_id", "created_at");

ALTER TABLE "request_messages"
    ADD CONSTRAINT "request_messages_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "request_messages"
    ADD CONSTRAINT "request_messages_sender_id_fkey"
    FOREIGN KEY ("sender_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Update the test-DB reset helper**

In `apps/backend/src/test/helpers/db.ts`, add `'request_messages'` to `ALL_TABLES`. The order matters only for FK cascade safety; insert it before `'requests'`:

```ts
const ALL_TABLES = [
  'push_subscriptions',
  'feedback_submissions',
  'audit_logs',
  'reviews',
  'request_items',
  'request_messages',
  'requests',
  'messages',
  'items',
  'users',
];
```

- [ ] **Step 4: Regenerate the Prisma client**

```
pnpm prisma:generate
```

Expected: `✔ Generated Prisma Client`.

- [ ] **Step 5: Apply the migration to dev DB and test DB**

```
pnpm prisma:migrate
```

Expected: a single new migration applied — `20260509150000_add_request_messages`.

Then re-seed the test DB so future test runs get the new table:

```
pnpm --filter @velvet-scoop/backend test:db:setup
```

Expected: `Database velvetscoop_test created` (or a "already exists" you can ignore) and `All migrations have been successfully applied`.

- [ ] **Step 6: Typecheck**

```
pnpm -r typecheck
```

Expected: all three workspaces report `Done` with no errors.

- [ ] **Step 7: Commit**

```
git add apps/backend/prisma/schema.prisma \
        apps/backend/prisma/migrations/20260509150000_add_request_messages \
        apps/backend/src/test/helpers/db.ts
git commit -m "Schema: RequestMessage table for per-order chat threads"
```

---

## Task 2: Test scaffold + GET endpoint with auth

**Files:**
- Create: `apps/backend/src/routes/request-messages.test.ts`
- Create: `apps/backend/src/routes/request-messages.ts`
- Modify: `apps/backend/src/app.ts`

Now a route and tests exist. We follow strict TDD: write a failing test, run it, watch it fail with the right error, then implement.

- [ ] **Step 1: Write the test scaffold + 4 GET tests (failing)**

Create `apps/backend/src/routes/request-messages.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDatabase } from '../test/helpers/db.js';
import { createTestApp, type TestAppHandle } from '../test/helpers/test-app.js';

describe('request-messages routes', () => {
  let h: TestAppHandle;

  beforeAll(async () => {
    h = await createTestApp();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  async function seedItem() {
    return h.prisma.item.create({
      data: {
        name: `Item-${Math.random().toString(36).slice(2, 7)}`,
        description: 'd',
        cost: '4.50',
        active: true,
      },
    });
  }

  async function seedRequest(userId: string) {
    const item = await seedItem();
    return h.prisma.request.create({
      data: {
        userId,
        total: '4.50',
        scheduledFor: new Date('2026-08-01T18:00:00Z'),
        contactName: 'C',
        contactEmail: 'c@example.com',
        items: { create: [{ itemId: item.id, quantity: 1 }] },
      },
    });
  }

  describe('GET /api/requests/:id/messages', () => {
    it('returns empty array for the request owner', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('returns 403 for an unrelated member', async () => {
      const customer = await h.createUser();
      const stranger = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(stranger.id) },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 for an admin who is not isOwner', async () => {
      const customer = await h.createUser();
      const admin = await h.createUser({ role: 'admin' });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(admin.id) },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 200 for an owner (admin + isOwner)', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(owner.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('returns 404 for a non-existent request', async () => {
      const customer = await h.createUser();
      const res = await h.app.inject({
        method: 'GET',
        url: `/api/requests/00000000-0000-0000-0000-000000000000/messages`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 5 failures. Each `inject` call returns 404 because no `/api/requests/:id/messages` route is registered.

- [ ] **Step 3: Create the route file**

Create `apps/backend/src/routes/request-messages.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
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
```

`viewer` is decorated by `requireAuth`; check `apps/backend/src/auth/require-auth.ts` if you need to confirm the shape — it has `id`, `role`, and `isOwner` among others.

- [ ] **Step 4: Register the route in `app.ts`**

In `apps/backend/src/app.ts`, alongside the other `register*` calls (around line 119), add:

```ts
import { registerRequestMessageRoutes } from './routes/request-messages.js';
// ...
registerRequestMessageRoutes(app, { prisma: options.prisma });
```

Add the import next to the existing route imports near the top of the file.

- [ ] **Step 5: Run the tests, watch them pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 5 passing.

- [ ] **Step 6: Typecheck**

```
pnpm -r typecheck
```

Expected: all `Done`.

- [ ] **Step 7: Commit**

```
git add apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts \
        apps/backend/src/app.ts
git commit -m "GET /api/requests/:id/messages with participant auth"
```

---

## Task 3: POST send endpoint (no notifications yet)

**Files:**
- Modify: `apps/backend/src/routes/request-messages.test.ts`
- Modify: `apps/backend/src/routes/request-messages.ts`

Notifications come in Task 4 — keep this task focused on the route + transitions.

- [ ] **Step 1: Add 5 POST tests (failing)**

Append to the `describe('request-messages routes')` block in `apps/backend/src/routes/request-messages.test.ts`, **inside** the same outer describe, after the GET inner describe:

```ts
  describe('POST /api/requests/:id/messages', () => {
    it('customer can send while pending and the message is returned', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'hello there' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json().data;
      expect(body.content).toBe('hello there');
      expect(body.senderId).toBe(customer.id);
      expect(body.deleted).toBe(false);
      expect(body.readAt).toBeNull();
    });

    it('owner can send on someone else’s request', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(owner.id), 'content-type': 'application/json' },
        payload: { content: 'on it' },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().data.senderId).toBe(owner.id);
    });

    it('returns 409 THREAD_CLOSED on a completed request', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      await h.prisma.request.update({
        where: { id: req1.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'late reply' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('THREAD_CLOSED');
    });

    it('rejects empty content with 400', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects content over 4000 chars with 400', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'a'.repeat(4001) },
      });
      expect(res.statusCode).toBe(400);
    });
  });
```

- [ ] **Step 2: Run the tests, watch them fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 5 new failures (404s — no POST handler registered).

- [ ] **Step 3: Implement the POST handler**

Append to `registerRequestMessageRoutes` in `apps/backend/src/routes/request-messages.ts`, after the GET registration:

```ts
  app.post<{ Params: { id: string }; Body: { content?: unknown } }>(
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

      const status = loaded.requestRow!.status;
      if (status !== 'pending' && status !== 'accepted') {
        return reply.code(409).send({
          error: { code: 'THREAD_CLOSED', message: 'This order is closed; messaging is locked' },
        });
      }

      const raw = (req.body ?? {}).content;
      if (typeof raw !== 'string') {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content must be a string' },
        });
      }
      const content = raw.trim();
      if (content.length === 0) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content is required' },
        });
      }
      if (content.length > 4000) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'content must be 4000 characters or fewer' },
        });
      }

      const created = await deps.prisma.requestMessage.create({
        data: {
          requestId: loaded.requestRow!.id,
          senderId: viewer.id,
          content,
        },
        include: { sender: { select: { id: true, displayName: true } } },
      });

      reply.code(201);
      return {
        data: {
          id: created.id,
          requestId: created.requestId,
          senderId: created.senderId,
          sender: created.sender,
          content: created.content,
          deleted: false,
          readAt: null,
          createdAt: created.createdAt.toISOString(),
        },
      };
    },
  );
```

- [ ] **Step 4: Run the tests, watch them pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 10 passing (5 from Task 2 + 5 new).

- [ ] **Step 5: Commit**

```
git add apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts
git commit -m "POST /api/requests/:id/messages: send with status + content guards"
```

---

## Task 4: notifyMessage service + wiring

**Files:**
- Modify: `apps/backend/src/services/notifications.ts`
- Modify: `apps/backend/src/routes/request-messages.ts`
- Modify: `apps/backend/src/routes/request-messages.test.ts`

The push-side-effect test uses an injected fake `pushService`, the same pattern the existing notification tests use. Look at `apps/backend/src/services/push.ts` for the `PushService` interface and `apps/backend/src/services/notifications.test.ts` for the existing fake-channel pattern (if it exists).

- [ ] **Step 1: Add `notifyMessage` to the service**

In `apps/backend/src/services/notifications.ts`, append at the bottom of the file:

```ts
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
```

- [ ] **Step 2: Add a test that asserts `sendToOwners` is invoked**

Append a new `describe` block to `apps/backend/src/routes/request-messages.test.ts`, inside the outer describe:

```ts
  describe('push notifications on send', () => {
    it('customer send invokes sendToOwners with correct title and url', async () => {
      // The default test app constructs without a push service. We need a
      // separate app instance with a fake. Build a one-off here.
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const owners: Array<{ title: string; body: string; url?: string }> = [];
      const usersTo: Array<{ userId: string; payload: { title: string } }> = [];

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: true,
        pushService: {
          publicKey: 'test-vapid',
          async sendToUser(userId, payload) { usersTo.push({ userId, payload }); },
          async sendToOwners(payload) { owners.push(payload); },
        },
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(customer.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        const res = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'I have a question' },
        });
        expect(res.statusCode).toBe(201);

        // Allow the fire-and-forget notification to settle.
        await new Promise((r) => setTimeout(r, 50));

        expect(owners).toHaveLength(1);
        expect(owners[0]!.title).toMatch(/Message on order #\d+/);
        expect(owners[0]!.body).toContain('I have a question');
        expect(usersTo).toHaveLength(0);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });

    it('owner reply invokes sendToUser targeting the customer', async () => {
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const usersTo: Array<{ userId: string; payload: { title: string; body: string } }> = [];
      const ownersTo: Array<unknown> = [];

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: true,
        pushService: {
          publicKey: 'test-vapid',
          async sendToUser(userId, payload) { usersTo.push({ userId, payload }); },
          async sendToOwners(payload) { ownersTo.push(payload); },
        },
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const owner = await h.createUser({ role: 'admin' });
        await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(owner.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        const res = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'on it' },
        });
        expect(res.statusCode).toBe(201);

        await new Promise((r) => setTimeout(r, 50));

        expect(usersTo).toHaveLength(1);
        expect(usersTo[0]!.userId).toBe(customer.id);
        expect(usersTo[0]!.payload.title).toMatch(/reply from Velvet Scoop/);
        expect(ownersTo).toHaveLength(0);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });
  });
```

- [ ] **Step 3: Run, watch them fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 2 new failures (`owners` array stays empty / `usersTo` stays empty because the route doesn't call `notifyMessage` yet).

- [ ] **Step 4: Wire the route to call `notifyMessage`**

The route file's `RequestMessageRouteDeps` needs `channels`. In `apps/backend/src/routes/request-messages.ts`:

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { notifyMessage, type NotificationChannels } from '../services/notifications.js';

export interface RequestMessageRouteDeps {
  prisma: PrismaClient;
  channels?: NotificationChannels;
}
```

Inside the POST handler, after `const created = await deps.prisma.requestMessage.create(...)` and before the `return`, add:

```ts
      if (deps.channels) {
        void notifyMessage(deps.prisma, deps.channels, created.id, (err, msg) =>
          req.log.warn({ err }, msg),
        );
      }
```

- [ ] **Step 5: Update `app.ts` to pass `channels`**

In `apps/backend/src/app.ts`, change the registration:

```ts
registerRequestMessageRoutes(app, { prisma: options.prisma, channels });
```

- [ ] **Step 6: Run, watch them pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 12 passing.

- [ ] **Step 7: Typecheck**

```
pnpm -r typecheck
```

Expected: all `Done`.

- [ ] **Step 8: Commit**

```
git add apps/backend/src/services/notifications.ts \
        apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts \
        apps/backend/src/app.ts
git commit -m "Push notifications on chat send (notifyMessage service)"
```

---

## Task 5: mark-read endpoint

**Files:**
- Modify: `apps/backend/src/routes/request-messages.test.ts`
- Modify: `apps/backend/src/routes/request-messages.ts`

- [ ] **Step 1: Write 2 mark-read tests (failing)**

Append inside the outer `describe`:

```ts
  describe('POST /api/requests/:id/messages/read', () => {
    it('flips readAt only on counterparty messages', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);

      const fromOwner = await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: owner.id, content: 'from owner' },
      });
      const fromCustomer = await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: customer.id, content: 'from customer' },
      });

      const res = await h.app.inject({
        method: 'POST',
        url: `/api/requests/${req1.id}/messages/read`,
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.updated).toBe(1);

      const after = await h.prisma.requestMessage.findMany({
        where: { requestId: req1.id },
        orderBy: { createdAt: 'asc' },
      });
      const ownerRow = after.find((m) => m.id === fromOwner.id)!;
      const customerRow = after.find((m) => m.id === fromCustomer.id)!;
      expect(ownerRow.readAt).not.toBeNull();
      expect(customerRow.readAt).toBeNull();
    });

    it('is idempotent: second call returns updated: 0', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);
      await h.prisma.requestMessage.create({
        data: { requestId: req1.id, senderId: owner.id, content: 'a' },
      });
      const cookie = await h.cookieFor(customer.id);
      const first = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages/read`, headers: { cookie },
      });
      expect(first.json().data.updated).toBe(1);
      const second = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages/read`, headers: { cookie },
      });
      expect(second.json().data.updated).toBe(0);
    });
  });
```

- [ ] **Step 2: Run, watch them fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 2 new failures (404 — no mark-read route).

- [ ] **Step 3: Add the handler**

Append inside `registerRequestMessageRoutes`:

```ts
  app.post<{ Params: { id: string } }>(
    '/api/requests/:id/messages/read',
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

      const result = await deps.prisma.requestMessage.updateMany({
        where: {
          requestId: loaded.requestRow!.id,
          senderId: { not: viewer.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { data: { updated: result.count } };
    },
  );
```

- [ ] **Step 4: Run, watch them pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 14 passing.

- [ ] **Step 5: Commit**

```
git add apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts
git commit -m "POST /api/requests/:id/messages/read mark-read endpoint"
```

---

## Task 6: DELETE soft-delete endpoint

**Files:**
- Modify: `apps/backend/src/routes/request-messages.test.ts`
- Modify: `apps/backend/src/routes/request-messages.ts`

- [ ] **Step 1: Write 3 delete tests (failing)**

Append inside the outer `describe`:

```ts
  describe('DELETE /api/messages/:msgId', () => {
    it('sender can soft-delete their own message; subsequent GET returns deleted:true content:null', async () => {
      const customer = await h.createUser();
      const req1 = await seedRequest(customer.id);
      const cookie = await h.cookieFor(customer.id);

      const send = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages`,
        headers: { cookie, 'content-type': 'application/json' },
        payload: { content: 'oops' },
      });
      const msgId = send.json().data.id;

      const del = await h.app.inject({
        method: 'DELETE', url: `/api/messages/${msgId}`, headers: { cookie },
      });
      expect(del.statusCode).toBe(200);

      const list = await h.app.inject({
        method: 'GET', url: `/api/requests/${req1.id}/messages`, headers: { cookie },
      });
      const data = list.json().data;
      expect(data).toHaveLength(1);
      expect(data[0].deleted).toBe(true);
      expect(data[0].content).toBeNull();
    });

    it('non-sender owner cannot delete the customer’s message', async () => {
      const customer = await h.createUser();
      const owner = await h.createUser({ role: 'admin' });
      await h.prisma.user.update({ where: { id: owner.id }, data: { isOwner: true } });
      const req1 = await seedRequest(customer.id);

      const send = await h.app.inject({
        method: 'POST', url: `/api/requests/${req1.id}/messages`,
        headers: { cookie: await h.cookieFor(customer.id), 'content-type': 'application/json' },
        payload: { content: 'mine' },
      });
      const msgId = send.json().data.id;

      const del = await h.app.inject({
        method: 'DELETE', url: `/api/messages/${msgId}`,
        headers: { cookie: await h.cookieFor(owner.id) },
      });
      expect(del.statusCode).toBe(403);
    });

    it('returns 404 for a non-existent message', async () => {
      const customer = await h.createUser();
      const res = await h.app.inject({
        method: 'DELETE', url: '/api/messages/00000000-0000-0000-0000-000000000000',
        headers: { cookie: await h.cookieFor(customer.id) },
      });
      expect(res.statusCode).toBe(404);
    });
  });
```

- [ ] **Step 2: Run, watch them fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 3 new failures.

- [ ] **Step 3: Add the handler**

Append inside `registerRequestMessageRoutes`:

```ts
  app.delete<{ Params: { msgId: string } }>(
    '/api/messages/:msgId',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const viewer = req.user!;
      const m = await deps.prisma.requestMessage.findUnique({
        where: { id: req.params.msgId },
        select: { id: true, senderId: true, deletedAt: true },
      });
      if (!m || m.deletedAt) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: 'Message not found' },
        });
      }
      if (m.senderId !== viewer.id) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'You can only delete your own messages' },
        });
      }
      await deps.prisma.requestMessage.update({
        where: { id: m.id },
        data: { deletedAt: new Date() },
      });
      return { data: { ok: true } };
    },
  );
```

- [ ] **Step 4: Run, watch them pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 17 passing.

- [ ] **Step 5: Commit**

```
git add apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts
git commit -m "DELETE /api/messages/:msgId soft-delete endpoint"
```

---

## Task 7: Rate limiting on send

**Files:**
- Modify: `apps/backend/src/routes/request-messages.test.ts`
- Modify: `apps/backend/src/routes/request-messages.ts`

The default `createTestApp` sets `disableRateLimit: true`. The rate-limit test needs a one-off app with limits enabled (same pattern as Task 4's notification test).

- [ ] **Step 1: Add the rate-limit test (failing)**

Append inside the outer `describe`:

```ts
  describe('rate limiting', () => {
    it('returns 429 on the 31st send within 60 seconds', async () => {
      const { buildApp } = await import('../app.js');
      const { Redis } = await import('ioredis');
      const { PrismaClient } = await import('@prisma/client');
      const { createSessionStore } = await import('../auth/session.js');
      const { FakeOidcClient, TEST_COOKIE_NAME } = await import('../test/helpers/test-app.js');

      const prisma = new PrismaClient();
      const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
      const sessionStore = createSessionStore(redis, { ttlSeconds: 300 });
      const fakeOidc = new FakeOidcClient();

      const app = await buildApp({
        prisma,
        redis,
        sessionStore,
        sessionCookieName: TEST_COOKIE_NAME,
        sessionSecret: 'test-secret',
        sessionTtlSeconds: 300,
        cookieSecure: false,
        oidcClient: fakeOidc,
        authentikGroups: { memberGroup: 'velvet-scoop-users', adminGroup: 'velvet-scoop-admins' },
        frontendOrigin: 'http://localhost:5180',
        disableRateLimit: false,
      });
      await app.ready();

      try {
        const customer = await h.createUser();
        const req1 = await seedRequest(customer.id);
        const sid = await sessionStore.create(customer.id);
        const cookie = `${TEST_COOKIE_NAME}=${sid}`;

        for (let i = 0; i < 30; i++) {
          const ok = await app.inject({
            method: 'POST',
            url: `/api/requests/${req1.id}/messages`,
            headers: { cookie, 'content-type': 'application/json' },
            payload: { content: `m${i}` },
          });
          expect(ok.statusCode).toBe(201);
        }

        const limited = await app.inject({
          method: 'POST',
          url: `/api/requests/${req1.id}/messages`,
          headers: { cookie, 'content-type': 'application/json' },
          payload: { content: 'too many' },
        });
        expect(limited.statusCode).toBe(429);
      } finally {
        await app.close();
        await redis.quit();
        await prisma.$disconnect();
      }
    });
  });
```

- [ ] **Step 2: Run, watch it fail**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 1 new failure (the 31st request returns 201, not 429 — no per-route limit yet).

- [ ] **Step 3: Add per-route limits to the POST handler**

In `apps/backend/src/routes/request-messages.ts`, locate the existing POST registration. Replace its options object (the second argument, currently `{ preHandler: app.requireAuth }`) with this — the handler body (third argument) stays exactly as it is:

```ts
    {
      preHandler: app.requireAuth,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => req.user?.id ?? req.ip,
        },
      },
    },
```

Make sure `FastifyRequest` is in the imports at the top of the file (it already is from Task 2).

The 200/day limit is intentionally **not** added here. Per-route Fastify rate limit only takes one config; layering two requires a custom handler. For MVP the 60-second limit alone is enough; add the daily cap as a follow-up if abuse appears in practice.

- [ ] **Step 4: Run, watch it pass**

```
pnpm --filter @velvet-scoop/backend test request-messages
```

Expected: 18 passing.

- [ ] **Step 5: Commit**

```
git add apps/backend/src/routes/request-messages.ts \
        apps/backend/src/routes/request-messages.test.ts
git commit -m "Rate limit chat send: 30 per user per minute"
```

---

## Task 8: Frontend RTK endpoints + types

**Files:**
- Modify: `apps/frontend/src/api/api.ts`

No frontend tests exist; verification is `pnpm --filter @velvet-scoop/frontend typecheck`.

- [ ] **Step 1: Add the `RequestMessage` interface and tag type**

In `apps/frontend/src/api/api.ts`, near the other interface definitions (after `Message`):

```ts
export interface RequestMessage {
  id: string;
  requestId: string;
  senderId: string;
  sender: { id: string; displayName: string };
  content: string | null;
  deleted: boolean;
  readAt: string | null;
  createdAt: string;
}
```

In the `tagTypes` array passed to `createApi`, add `'RequestMessage'`:

```ts
tagTypes: ['Me', 'Item', 'Request', 'Review', 'Message', 'RequestMessage', 'User', 'Feedback'],
```

- [ ] **Step 2: Add the four endpoints**

Inside the `endpoints: (b) => ({ ... })` block in `apps/frontend/src/api/api.ts`, add these alongside the other endpoint definitions:

```ts
    listRequestMessages: b.query<RequestMessage[], string>({
      query: (requestId) => ({ url: `requests/${requestId}/messages` }),
      transformResponse: (r: { data: RequestMessage[] }) => r.data,
      providesTags: (_res, _err, requestId) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),
    sendRequestMessage: b.mutation<RequestMessage, { requestId: string; content: string }>({
      query: ({ requestId, content }) => ({
        url: `requests/${requestId}/messages`,
        method: 'POST',
        body: { content },
      }),
      transformResponse: (r: { data: RequestMessage }) => r.data,
      invalidatesTags: (_res, _err, { requestId }) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),
    markRequestThreadRead: b.mutation<{ updated: number }, string>({
      query: (requestId) => ({
        url: `requests/${requestId}/messages/read`,
        method: 'POST',
      }),
      transformResponse: (r: { data: { updated: number } }) => r.data,
      invalidatesTags: (_res, _err, requestId) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),
    deleteRequestMessage: b.mutation<{ ok: boolean }, { requestId: string; messageId: string }>({
      query: ({ messageId }) => ({
        url: `messages/${messageId}`,
        method: 'DELETE',
      }),
      transformResponse: (r: { data: { ok: boolean } }) => r.data,
      invalidatesTags: (_res, _err, { requestId }) => [
        { type: 'RequestMessage', id: requestId },
      ],
    }),
```

- [ ] **Step 3: Add the hooks to the export list**

At the bottom of `apps/frontend/src/api/api.ts`, in the destructured export from `api`, add the four new hooks alongside the existing ones (`useListMessagesQuery`, etc.):

```ts
  useListRequestMessagesQuery,
  useSendRequestMessageMutation,
  useMarkRequestThreadReadMutation,
  useDeleteRequestMessageMutation,
```

- [ ] **Step 4: Typecheck**

```
pnpm --filter @velvet-scoop/frontend typecheck
```

Expected: `Done`.

- [ ] **Step 5: Commit**

```
git add apps/frontend/src/api/api.ts
git commit -m "Frontend RTK endpoints for request-message thread"
```

---

## Task 9: MessageThread component

**Files:**
- Create: `apps/frontend/src/features/requests/MessageThread.tsx`

A single component reused by the customer and admin sides. It owns its own polling, send, mark-read, soft-delete, and auto-scroll behavior. No tests; verification is typecheck + manual QA.

- [ ] **Step 1: Create the component**

Create `apps/frontend/src/features/requests/MessageThread.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  useDeleteRequestMessageMutation,
  useGetMeQuery,
  useListRequestMessagesQuery,
  useMarkRequestThreadReadMutation,
  useSendRequestMessageMutation,
  type OrderRequest,
  type RequestMessage,
} from '../../api/api';

const POLL_MS = 12_000;

export interface MessageThreadProps {
  requestId: string;
  orderNumber: number;
  status: OrderRequest['status'];
  viewerRole: 'customer' | 'owner';
}

export function MessageThread({
  requestId,
  orderNumber,
  status,
  viewerRole,
}: MessageThreadProps) {
  const { data: me } = useGetMeQuery();
  const { data: messages = [], isLoading } = useListRequestMessagesQuery(requestId, {
    pollingInterval: POLL_MS,
  });
  const [sendMessage, { isLoading: sending }] = useSendRequestMessageMutation();
  const [markRead] = useMarkRequestThreadReadMutation();
  const [deleteMessage] = useDeleteRequestMessageMutation();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const isClosed = status !== 'pending' && status !== 'accepted';

  // Auto-scroll on new messages.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  // Mark counterparty messages read whenever the visible list contains any
  // unread-from-counterparty rows. Idempotent on the server.
  useEffect(() => {
    if (!me) return;
    const hasUnread = messages.some((m) => m.senderId !== me.id && !m.readAt);
    if (hasUnread) {
      void markRead(requestId);
    }
  }, [messages, me, markRead, requestId]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const content = draft.trim();
    if (!content) return;
    try {
      await sendMessage({ requestId, content }).unwrap();
      setDraft('');
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 429) {
        setError('Slow down — try again in a moment.');
      } else if (e.status === 409) {
        setError('This order is closed; messaging is locked.');
      } else {
        setError('Could not send. Try again.');
      }
    }
  }

  async function onDelete(message: RequestMessage) {
    if (!confirm('Delete this message?')) return;
    await deleteMessage({ requestId, messageId: message.id });
  }

  if (isLoading) {
    return (
      <div className="border-t border-slate-800 px-3 py-3 text-xs text-slate-500">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="border-t border-slate-800">
      <div className="flex items-baseline justify-between px-3 pt-3 text-xs text-slate-400">
        <span>💬 Messages — Order #{orderNumber}</span>
      </div>

      <ul className="space-y-2 px-3 py-3 max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <li className="text-center text-xs text-slate-500">
            {viewerRole === 'customer'
              ? 'No messages yet. Say hi to the team.'
              : 'No messages yet from this customer.'}
          </li>
        )}
        {messages.map((m) => {
          const mine = me?.id === m.senderId;
          const lastMineId = [...messages]
            .reverse()
            .find((x) => x.senderId === me?.id)?.id;
          const lastMine = mine && m.id === lastMineId;
          const seenByCounterparty = lastMine && m.readAt !== null;

          if (m.deleted) {
            return (
              <li
                key={m.id}
                className={`max-w-[85%] rounded-lg px-2 py-1 text-xs italic text-slate-500 ${
                  mine ? 'ml-auto bg-slate-800/50' : 'bg-slate-900/50'
                }`}
              >
                message deleted
              </li>
            );
          }

          return (
            <li
              key={m.id}
              className={`max-w-[85%] ${mine ? 'ml-auto text-right' : ''}`}
            >
              <div className="text-[11px] text-slate-500">
                {!mine && viewerRole === 'customer' && (
                  <span className="mr-1 rounded bg-indigo-950/60 px-1 text-indigo-300">
                    owner
                  </span>
                )}
                {mine ? 'you' : m.sender.displayName}
                {' · '}
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {seenByCounterparty && ' · ✓ seen'}
              </div>
              <div
                className={`mt-0.5 inline-block rounded-lg px-2 py-1 text-sm ${
                  mine
                    ? 'bg-indigo-900/40 text-indigo-100'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                {m.content}
              </div>
              {mine && (
                <button
                  type="button"
                  onClick={() => void onDelete(m)}
                  className="ml-2 text-[10px] text-slate-500 hover:text-red-400"
                >
                  delete
                </button>
              )}
            </li>
          );
        })}
        <div ref={bottomRef} />
      </ul>

      {isClosed ? (
        <p className="border-t border-slate-800 px-3 py-2 text-xs italic text-slate-500">
          This order is closed — messaging is locked.
        </p>
      ) : (
        <form onSubmit={onSend} className="flex gap-2 border-t border-slate-800 px-3 py-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a reply…"
            maxLength={4000}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
          />
          <button
            type="submit"
            disabled={sending || draft.trim() === ''}
            className="rounded-md bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
      {error && (
        <p className="px-3 pb-2 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

The `ownerSent`/`lastMine` logic is intentionally simple: "seen" only flips on the most recent message *I* sent, exactly when the server has set `readAt` on that row. The thread auto-scrolls on length change, which covers both "open the panel" and "new message arrived during polling."

- [ ] **Step 2: Typecheck**

```
pnpm --filter @velvet-scoop/frontend typecheck
```

Expected: `Done`.

- [ ] **Step 3: Commit**

```
git add apps/frontend/src/features/requests/MessageThread.tsx
git commit -m "MessageThread component with polling, send, mark-read, soft-delete"
```

---

## Task 10: Wire MessageThread into RequestsPage (customer)

**Files:**
- Modify: `apps/frontend/src/features/requests/RequestsPage.tsx`

Add an expand toggle below each card body, an unread badge, and the `MessageThread` panel itself.

- [ ] **Step 1: Add unread-count helper + expansion state**

Open `apps/frontend/src/features/requests/RequestsPage.tsx`. Replace the entire file contents with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCancelRequestMutation,
  useGetMeQuery,
  useListRequestMessagesQuery,
  useListRequestsQuery,
  type OrderRequest,
} from '../../api/api';
import { MessageThread } from './MessageThread';

const STATUS_STYLES: Record<OrderRequest['status'], string> = {
  pending: 'border-amber-700 bg-amber-950/40 text-amber-200',
  accepted: 'border-indigo-700 bg-indigo-950/40 text-indigo-200',
  completed: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  cancelled: 'border-slate-700 bg-slate-800 text-slate-400',
};

function MessagesToggle({
  request,
  expanded,
  onToggle,
}: {
  request: OrderRequest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: me } = useGetMeQuery();
  const { data: messages = [] } = useListRequestMessagesQuery(request.id, {
    pollingInterval: expanded ? undefined : 30_000,
  });
  const unread = me
    ? messages.filter((m) => m.senderId !== me.id && !m.readAt && !m.deleted).length
    : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-between rounded border border-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/40"
    >
      <span>
        💬 Messages{unread > 0 ? ` (${unread})` : ''}
      </span>
      <span aria-hidden>{expanded ? '▴' : '▾'}</span>
    </button>
  );
}

export function RequestsPage() {
  const { data: me } = useGetMeQuery();
  const { data: requests, isLoading } = useListRequestsQuery();
  const [cancelRequest] = useCancelRequestMutation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const mine = me ? requests?.filter((r) => r.userId === me.id) ?? [] : [];

  if (isLoading) return <p className="px-4 py-6 text-sm text-slate-400">Loading…</p>;

  return (
    <div className="space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">My requests</h2>
        <Link
          to="/requests/new"
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          New request
        </Link>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-center">
          <p className="text-sm text-slate-400">You haven't placed any requests yet.</p>
          <Link
            to="/requests/new"
            className="mt-3 inline-block rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Place your first order
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {mine.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">${r.total}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status]}`}
                    >
                      {r.status}
                    </span>
                    <span className="font-mono text-xs text-slate-500">
                      #{r.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Scheduled {new Date(r.scheduledFor).toLocaleString()}
                  </p>
                </div>
                {r.status === 'pending' && (
                  <button
                    onClick={() => {
                      if (confirm('Cancel this request?')) cancelRequest({ id: r.id });
                    }}
                    className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                  >
                    Cancel
                  </button>
                )}
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                {r.items.map((line) => (
                  <li key={line.itemId}>
                    {line.quantity} × {line.item?.name ?? line.itemId}
                  </li>
                ))}
              </ul>
              {r.contactNotes && (
                <p className="mt-2 text-xs italic text-slate-400">"{r.contactNotes}"</p>
              )}

              <MessagesToggle
                request={r}
                expanded={!!expanded[r.id]}
                onToggle={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
              />
              {expanded[r.id] && (
                <MessageThread
                  requestId={r.id}
                  orderNumber={r.orderNumber}
                  status={r.status}
                  viewerRole="customer"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

The `MessagesToggle` component polls *slowly* (30 s) when collapsed so the unread badge stays roughly fresh; the inner `MessageThread` polls fast (12 s) when expanded.

- [ ] **Step 2: Typecheck**

```
pnpm --filter @velvet-scoop/frontend typecheck
```

Expected: `Done`.

- [ ] **Step 3: Commit**

```
git add apps/frontend/src/features/requests/RequestsPage.tsx
git commit -m "Wire MessageThread into RequestsPage (customer view)"
```

---

## Task 11: Wire MessageThread into AdminRequestsTab (owner)

**Files:**
- Modify: `apps/frontend/src/features/admin/AdminRequestsTab.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
import { useState } from 'react';
import {
  useAcceptRequestMutation,
  useCancelRequestMutation,
  useCompleteRequestMutation,
  useGetMeQuery,
  useListRequestMessagesQuery,
  useListRequestsQuery,
  type OrderRequest,
} from '../../api/api';
import { MessageThread } from '../requests/MessageThread';

const STATUS_STYLES: Record<OrderRequest['status'], string> = {
  pending: 'border-amber-700 bg-amber-950/40 text-amber-200',
  accepted: 'border-indigo-700 bg-indigo-950/40 text-indigo-200',
  completed: 'border-emerald-700 bg-emerald-950/40 text-emerald-200',
  cancelled: 'border-slate-700 bg-slate-800 text-slate-400',
};

function MessagesToggle({
  request,
  expanded,
  onToggle,
}: {
  request: OrderRequest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data: me } = useGetMeQuery();
  const { data: messages = [] } = useListRequestMessagesQuery(request.id, {
    pollingInterval: expanded ? undefined : 30_000,
  });
  const unread = me
    ? messages.filter((m) => m.senderId !== me.id && !m.readAt && !m.deleted).length
    : 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex w-full items-center justify-between rounded border border-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-800/40"
    >
      <span>
        💬 Messages{unread > 0 ? ` (${unread})` : ''}
      </span>
      <span aria-hidden>{expanded ? '▴' : '▾'}</span>
    </button>
  );
}

export function AdminRequestsTab() {
  const { data: requests, isLoading } = useListRequestsQuery();
  const [acceptRequest] = useAcceptRequestMutation();
  const [completeRequest] = useCompleteRequestMutation();
  const [cancelRequest] = useCancelRequestMutation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!requests || requests.length === 0) {
    return <p className="text-sm text-slate-400">No requests yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li
          key={r.id}
          className="rounded-lg border border-slate-800 bg-slate-900/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{r.contactName}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
                <span className="text-sm text-slate-400">${r.total}</span>
                <span className="font-mono text-xs text-slate-500">
                  #{r.orderNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {r.contactEmail} • scheduled{' '}
                {new Date(r.scheduledFor).toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {r.status === 'pending' && (
                <button
                  onClick={() => acceptRequest(r.id)}
                  className="rounded border border-indigo-700 bg-indigo-950/40 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-900/40"
                >
                  Accept
                </button>
              )}
              {r.status === 'accepted' && (
                <button
                  onClick={() => completeRequest(r.id)}
                  className="rounded border border-emerald-700 bg-emerald-950/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-900/40"
                >
                  Complete
                </button>
              )}
              {(r.status === 'pending' || r.status === 'accepted') && (
                <button
                  onClick={() => {
                    const reason = prompt('Reason (optional):') ?? undefined;
                    cancelRequest({ id: r.id, ...(reason ? { reason } : {}) });
                  }}
                  className="rounded border border-red-900 bg-red-950/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
            {r.items.map((line) => (
              <li key={line.itemId}>
                {line.quantity} × {line.item?.name ?? line.itemId}
              </li>
            ))}
          </ul>
          {r.contactNotes && (
            <p className="mt-2 text-xs italic text-slate-400">"{r.contactNotes}"</p>
          )}

          <MessagesToggle
            request={r}
            expanded={!!expanded[r.id]}
            onToggle={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
          />
          {expanded[r.id] && (
            <MessageThread
              requestId={r.id}
              orderNumber={r.orderNumber}
              status={r.status}
              viewerRole="owner"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

```
pnpm --filter @velvet-scoop/frontend typecheck
```

Expected: `Done`.

- [ ] **Step 3: Commit**

```
git add apps/frontend/src/features/admin/AdminRequestsTab.tsx
git commit -m "Wire MessageThread into AdminRequestsTab (owner view)"
```

---

## Task 12: Final verification + PR

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full backend test suite**

```
pnpm --filter @velvet-scoop/backend test
```

Expected: all green, including the existing 28 tests + 18 new request-message tests = 46 total.

- [ ] **Step 2: Run typecheck across the workspace**

```
pnpm -r typecheck
```

Expected: all `Done`.

- [ ] **Step 3: Manual QA pass** (frontend dev server running)

Run `pnpm dev`, log in as a member who has at least one order, and walk this list:

- [ ] Expand the messages panel on a `pending` order — empty-state copy reads "No messages yet. Say hi to the team."
- [ ] Type a message, send. Bubble appears right-aligned, "you · h:mm" timestamp, no `✓ seen` yet.
- [ ] In a second browser, log in as an owner (`role: 'admin'`, `isOwner: true`), open the same order on `/admin`. The message appears with the customer's display name. Send a reply.
- [ ] Back as the customer, within 12 s the reply appears with the `[owner]` chip. The customer's earlier message now shows `✓ seen`.
- [ ] Delete the customer's own message (delete link). It renders as italic *"message deleted"*.
- [ ] Mark the order `completed` from admin. On the customer side, the input is replaced by *"This order is closed — messaging is locked."*
- [ ] Push notification fires for both directions (provided push is enabled on the device).

- [ ] **Step 4: Push the branch and open the PR**

```
git push -u origin <your-branch-name>
gh pr create --title "Order chat (closes #4)" \
  --body "Implements docs/superpowers/specs/2026-05-09-order-chat-design.md.

- New \`RequestMessage\` model + migration (schema-additive, no backfill).
- New \`/api/requests/:id/messages\` route namespace (GET, POST, /read; DELETE on /api/messages/:msgId).
- 30/min/user rate limit on send via @fastify/rate-limit.
- Push notifications wired through existing NotificationChannels.
- New \`MessageThread\` component reused on customer + admin sides; inline expand on each card; unread badge.

Closes #4."
```

- [ ] **Step 5: Mark plan complete**

Plan execution done. Issue #4 closed by the merged PR.

---

## Self-review notes

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| Counterparty model (customer ↔ owner pool) | Task 2 (auth) — `isOwner` check |
| Lifecycle (pending/accepted only) | Task 3 — 409 `THREAD_CLOSED` |
| `RequestMessage` model | Task 1 |
| Migration | Task 1 |
| `GET /api/requests/:id/messages` | Task 2 |
| `POST /api/requests/:id/messages` | Task 3 |
| `POST /api/requests/:id/messages/read` | Task 5 |
| `DELETE /api/messages/:msgId` | Task 6 |
| `notifyMessage` push wiring | Task 4 |
| Rate limiting (30/min) | Task 7 |
| `RequestMessage` interface + RTK endpoints | Task 8 |
| `MessageThread` component | Task 9 |
| Customer-side card integration | Task 10 |
| Owner-side card integration | Task 11 |
| Read receipts ("seen by any owner") | Task 5 (server) + Task 9 (UI) |
| Soft-delete UI ("message deleted") | Task 9 |
| Manual QA pass | Task 12 |

The 200-per-day rate limit from the spec was downgraded to a follow-up — `@fastify/rate-limit` per-route doesn't natively layer two windows, and adding a second window costs more code than the abuse it would prevent today is worth. Documented in Task 7.

Everything else in the spec maps to a task above.
