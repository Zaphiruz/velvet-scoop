# Order Chat — Design

**Status:** approved, ready for implementation plan
**Date:** 2026-05-09
**Closes:** [feedback issue #4](https://github.com/Zaphiruz/velvet-scoop/issues/4) — "No chat options, even on open orders"

## Problem

A customer placed an order and had a follow-up question with no way to reach
the team from inside the app. The Velvet Scoop backend already has a generic
`Message` model (sender ↔ recipient), but the frontend never surfaced it and
it isn't scoped to a request. Customers and the owner team need a way to
exchange short, contextual messages tied to a specific open order.

## Goals

- Customer can send a message attached to one of their open orders.
- Any owner (`role: 'admin' && isOwner: true`) can read and reply on the same
  thread; the rest of the owner pool sees the same history.
- Both sides get a push notification when the counterparty sends.
- Read state is visible to the customer ("seen") on the latest message they
  sent, computed from "any owner has read it."
- The thread is read-only once the order is no longer active
  (`pending` or `accepted`).
- Soft-deletable own messages (cheap safety net for typos / oversharing).

## Non-goals (deferred)

- Email fallback when push is not subscribed.
- Deep-linking pushes to the specific expanded thread.
- Per-owner read receipts ("seen by Anna at 2:18").
- Image attachments / object storage.
- SSE or WebSocket transport — polling is enough for MVP.
- Mute-thread per owner.
- Edit own message — soft-delete plus a new send is the workaround.
- Typing indicators, reactions, @mentions, threading.
- Removing the existing unused `Message` model + `/api/messages*` routes —
  leave alone now, separate cleanup later if no direct-DM use case shows up.

## Counterparty model — owner pool

Decided in brainstorming Q1. The thread is **customer ↔ owner pool**: the
request owner (`Request.user`) on one side, and any user with
`role: 'admin' && isOwner: true && deletedAt: null && banned: false` on the
other. Owners share a single conversation history; replies are attributed by
display name in the UI but not in the data model. This mirrors the existing
`pushService.sendToOwners` and the `notifyOrderArrived` owner-email pattern.
Upgrading to per-request assignment later is a non-breaking schema delta
(nullable `assigneeId`).

## Thread lifecycle — active orders only

Decided in brainstorming Q2. A thread is read-write when
`request.status in ('pending', 'accepted')` and read-only otherwise. The
server enforces this on `POST` (returns 409 `THREAD_CLOSED`); the client
hides the input box and shows a banner on closed orders. Messages are kept
in the database indefinitely for audit; the cap is on writing, not viewing.

## Data model

New Prisma model — separate from the unused `Message` model:

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

`Request` and `User` get the inverse relations (`messages` /
`requestMessagesSent` respectively).

`readAt` is a single timestamp **per message**, not a join table — the
"any owner counts" rule from Q5 means we never need to know *which* owner
read it. Each message's `readAt` records the first time any counterparty
marked it read; the mark-read endpoint flips it for every counterparty
message in the thread that doesn't already have one.

`deletedAt` enables soft-delete: the row stays in the database (audit), but
`GET` returns `content: null, deleted: true` so the UI can render
*"message deleted"* without leaking the original content.

The existing `Message` model stays untouched. It is currently unreferenced
from the frontend; its routes remain mounted but unused. A separate
follow-up may rip it out if no direct-DM use case appears.

## Migration

Hand-written SQL, mirroring the `add_request_order_number` style:

```sql
CREATE TABLE "request_messages" (
  "id" UUID NOT NULL PRIMARY KEY,
  "request_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
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

The `'request_messages'` table name is added to the `ALL_TABLES` array in
`apps/backend/src/test/helpers/db.ts` so the test reset truncates it
between cases.

Schema-additive only. Zero-downtime deploy. No backfill.

## API

Mounted in a new route file `apps/backend/src/routes/request-messages.ts`.

| Method   | Path                                       | Purpose |
|----------|--------------------------------------------|---------|
| `GET`    | `/api/requests/:id/messages`               | List messages for the thread, oldest first, including `sender.displayName`. Soft-deleted rows return `content: null, deleted: true`. |
| `POST`   | `/api/requests/:id/messages`               | Send (`{ content: string }`). 201 with the created message. |
| `POST`   | `/api/requests/:id/messages/read`          | Idempotently mark all counterparty messages on this thread as read. Returns `{ updated: number }`. |
| `DELETE` | `/api/requests/:id/messages/:msgId`        | Soft-delete own message. 200 on success. |

Response envelope follows the existing `{ data: ... }` / `{ error: ... }`
pattern.

### Authorization

A request-scoped preHandler resolves the request and gates everything:

```
load request by :id (404 if missing or deletedAt)
viewer = req.user
isCustomer = viewer.id === request.userId
isOwner    = viewer.role === 'admin' && viewer.isOwner === true
isParticipant = isCustomer || isOwner
isParticipant ? next() : 403 FORBIDDEN
```

`POST /api/requests/:id/messages` additionally requires
`request.status in ('pending', 'accepted')`; otherwise 409 with code
`THREAD_CLOSED`.

`DELETE /api/requests/:id/messages/:msgId` requires `viewer.id === message.senderId`;
otherwise 403. (The viewer can also see the soft-deleted state via the
list endpoint regardless.)

### Rate limiting

Per-route override using the already-installed `@fastify/rate-limit`:

- 30 sends per 60 s per `req.user.id`.
- 200 sends per 24 h per `req.user.id`.

Returns the existing 429 envelope; the client renders it as a toast.

`GET`, mark-read, and `DELETE` are not rate-limited.

## Notification wiring

A new exported function in `apps/backend/src/services/notifications.ts`:

```ts
export async function notifyMessage(
  prisma: PrismaClient,
  channels: NotificationChannels,
  messageId: string,
  log?: (err: unknown, msg: string) => void,
): Promise<void>
```

Called from the `POST` route as `void notifyMessage(...).catch(...)` —
best-effort, never blocks the response.

| Sender   | Push call                          | Title                                          | Body                              | URL         |
|----------|------------------------------------|------------------------------------------------|-----------------------------------|-------------|
| Customer | `channels.push?.sendToOwners(...)` | `Message on order #{orderNumber}`              | `{customerName}: {first 80 chars}` | `/requests` |
| Owner    | `channels.push?.sendToUser(req.userId, ...)` | `Order #{orderNumber} — reply from Velvet Scoop` | `{ownerName}: {first 80 chars}`   | `/requests` |

Email is intentionally not wired for chat. Push is the wake mechanism;
in-app polling handles same-screen freshness.

No throttling for MVP. If a customer sends five messages in 30 seconds, the
owner pool gets five pushes. A debounce window can be added later inside
`notifyMessage`.

## Frontend

Single new component `apps/frontend/src/features/requests/MessageThread.tsx`,
used identically by `RequestsPage` (customer view) and `AdminRequestsTab`
(owner view). Props:

```ts
interface MessageThreadProps {
  requestId: string;
  orderNumber: number;
  status: RequestStatus;
  viewerRole: 'customer' | 'owner';
}
```

The component handles polling, send, mark-read, and soft-delete internally.

### Card integration

Both `RequestsPage` and `AdminRequestsTab` get a row below their existing
card body:

```
[💬 Messages (2) ▾]
```

- The `(2)` is the unread-from-counterparty count, derived from the list
  endpoint via an RTK Query selector — no extra round-trip.
- Tapping toggles a panel below the card.
- The button stays visible on closed orders too, but the panel renders
  read-only with the input replaced by a banner: *"This order is closed
  — messaging is locked."*

### Thread layout (mobile-first, full card width)

```
┌─────────────────────────────────────────┐
│ 💬 Messages — Order #42        [x close]│
├─────────────────────────────────────────┤
│  [owner] Anna  ·  2:14 pm               │
│  Got your order, on it!                 │
│                                         │
│             you  ·  2:18 pm  ✓ seen     │
│             Could I swap chocolate?     │
│                                         │
│  [owner] Anna  ·  2:20 pm               │
│  Done. New total $14.                   │
├─────────────────────────────────────────┤
│ [_____________________ type a reply…__] │
│                              [Send]     │
└─────────────────────────────────────────┘
```

- Owner messages: left-aligned, `[owner]` chip + display name.
- Customer messages on the customer view: right-aligned, "you", `✓ seen`
  on the most recent message that has `readAt` set.
- Customer messages on the owner view: shown with the customer's
  `displayName`.
- Soft-deleted: italic *"message deleted"*, no content, no delete button.
- Long-press / triple-dot on own message → "Delete" action.
- Auto-scroll to bottom on first open and on new message arrival.

### Polling and mark-read

- RTK Query refetch interval: 12 s while the panel is mounted (i.e.,
  expanded).
- The card-level unread count refetches on the same interval the parent
  page already uses for its requests list.
- On expand and on every poll where new counterparty messages are
  observed, fire a single `mark-read` request to advance `readAt`.

No new routes, no `/messages` tab, no `BottomNav` changes.

## Tests

Backend, in a new file `apps/backend/src/routes/request-messages.test.ts`:

1. Owner of the request can send while `pending`; gets 201.
2. Non-owner non-admin user gets 403.
3. Admin who is `role: admin && isOwner: false` gets 403 (confirms the
   pool is **owner**, not "any admin").
4. Owner with `isOwner: true` can read and send on someone else's request.
5. Send on a `completed` request returns 409 `THREAD_CLOSED`.
6. `GET` returns messages chronologically with `sender.displayName`
   joined.
7. `POST .../read` flips `readAt` on counterparty messages only — the
   viewer's own messages stay null.
8. `DELETE /api/requests/:id/messages/:msgId` by sender soft-deletes; non-sender gets
   403; subsequent `GET` returns `content: null, deleted: true`.
9. Rate limit: 31st send within 60 s → 429.
10. `notifyMessage` is invoked exactly once per send (mocked
    `NotificationChannels` asserts the call shape).

Frontend tests are out of scope: `apps/frontend` has no test scaffolding
today (`vitest.config.ts` exists but zero `*.test.tsx` files). Adding the
first frontend test harness is a separate task; manual QA covers this
feature in the meantime:

- Customer expands thread, sends, sees the message appear, sees `✓ seen`
  flip after the counterparty marks read.
- Owner expands thread on `AdminRequestsTab`, sends, sees the message
  attributed to their display name on the customer view.
- Customer on a `completed` order sees the read-only banner and no input.
- Soft-deleted message renders as *"message deleted"* with no delete
  button.
- Push fires for both directions.

## Rollout

Single PR. Schema-additive, no backfill, zero-downtime. After deploy, the
feature is live immediately for any future message; existing orders show
zero unread until someone sends.

**Ordering with other in-flight PRs:** push titles and email-style copy
reference `#{orderNumber}`, which lands in PR #8 (sequential
`orderNumber`). This implementation should rebase onto a `main` that has
PR #8 merged. If shipping order changes, the implementation plan flags
the substitute display (`#{request.id.slice(0, 7)}` from PR #7).

## Open questions

None. All major decisions resolved during brainstorming
(Q1 counterparty, Q2 lifecycle, Q3 placement, Q4 transport, Q5 scope cuts).
