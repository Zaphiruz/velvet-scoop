# Paid Flag — Design

**Status:** approved, ready for implementation plan
**Date:** 2026-05-15
**Closes:** [feedback issue #5](https://github.com/Zaphiruz/velvet-scoop/issues/5) — "Payment processing"

## Problem

Today payment for an accepted order happens entirely out-of-band (Venmo,
Zelle, cash, etc., correlated via the order number that was added in
PR #9). The app has no record of which orders have been paid for. The
owner has to reconcile by memory, by checking their banking app, or by
keeping a side spreadsheet. The customer has no visual confirmation in
the app that their payment landed.

The owner-builder of this app does not yet have business details for a
real payment provider (no Stripe account, no business tax ID, no bank
ready), so anything that processes money in-app is out of scope. The
smallest useful thing is an admin-controlled "this order is paid" flag.

## Goals

- Admin can mark a request **paid** and **unpaid** from the admin UI.
- Customer sees a "Paid" chip on their request card once it's marked
  paid.
- Every paid/unpaid transition is logged in `AuditLog` (matches the
  accept/complete/cancel pattern).
- The data model is forward-compatible with a future Stripe integration
  (the same `paidAt` column would just be flipped by a webhook instead
  of by an admin click).

## Non-goals (deferred)

- No payment provider integration (Stripe, Square, etc.).
- No in-app payment UI, no card form, no payment links.
- No automatic reconciliation against bank/Venmo/etc.
- No customer-facing notification when paid is flipped — the in-app
  chip is enough acknowledgment; the customer already knows they paid.
- No status gating on the `paid` flag (admin can flip it on any order
  status, including `cancelled` — useful for refund-tracking).
- No gate on the `Complete` button when an order is unpaid — owner
  manages their own workflow. Listed as a possible follow-up.
- No partial payments, deposits, or split payments.

## Data model

One column on the existing `Request` model:

```prisma
paidAt DateTime? @map("paid_at")
```

A nullable timestamp rather than a boolean. Same storage cost (8 bytes
either way), and you get "when did the payment land" for free —
useful in audits and any future reporting.

`null` = unpaid. Non-null = paid (timestamp is when admin flipped it
or, in a future Stripe integration, when the webhook fired).

## Migration

Hand-written SQL mirroring the existing `add_request_order_number` and
`add_request_messages` style:

```sql
ALTER TABLE "requests" ADD COLUMN "paid_at" TIMESTAMP(3);
```

Schema-additive, no backfill, no index needed (we never filter by
`paid_at` — only display it).

## API

Two new endpoints alongside the existing accept/complete/cancel
handlers in `apps/backend/src/routes/requests.ts`:

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `POST` | `/api/requests/:id/paid` | admin | Sets `paidAt = now()`. Returns the updated request. Idempotent (no-op when already paid; still 200). |
| `POST` | `/api/requests/:id/unpaid` | admin | Sets `paidAt = null`. Returns the updated request. Idempotent. |

**Auth:** Both endpoints use the existing `requireAuth` + `requireAdmin`
preHandler pair (same as accept/complete/cancel).

**Status gating:** None. Admin can mark/unmark paid on any
non-soft-deleted request regardless of `status`. The edge cases —
cancelled-but-refund-tracked, paid-cash-before-app-knew-about-it —
deserve to work, not error.

**Audit log:** Each transition writes an `AuditLog` row matching the
existing convention used by accept/complete/cancel:

```ts
{ actorId: viewer.id, entityType: 'Request', entityId, action: 'paid' | 'unpaid' }
```

**Notifications:** None. No email, no push.

## Frontend

`OrderRequest` TypeScript interface in `apps/frontend/src/api/api.ts`
gains `paidAt: string | null`.

Two new RTK Query mutations alongside the existing accept/complete/cancel:

```ts
markRequestPaid:   b.mutation<OrderRequest, string>({ url: ..., method: 'POST', ... })
markRequestUnpaid: b.mutation<OrderRequest, string>({ url: ..., method: 'POST', ... })
```

Both invalidate the `Request` tag so the list refetches.

### Customer view — `RequestsPage`

A read-only chip in the existing status row, shown only when
`paidAt !== null`:

```
$14   [accepted]   #42   [Paid]
```

Same chip shape as the existing status badge, emerald palette (matches
the "completed" status badge). No emoji, no tooltip — keeps style
consistent with the existing badges in `STATUS_STYLES`.

### Admin view — `AdminRequestsTab`

A new button in the existing button row, positioned next to
Accept/Complete/Cancel:

- When `paidAt === null`: `Mark paid` (slate / neutral palette).
- When `paidAt !== null`: `Paid ✓ (undo)` (emerald palette, click to unmark).

Single click flips. No confirm dialog — undo is one click and the
audit log captures both transitions if someone fat-fingers.

The "Paid" chip from the customer view ALSO renders on admin cards so
status is visible at a glance.

## Tests

In `apps/backend/src/routes/requests.test.ts`, adding to the existing
test suite (this file already covers accept/complete/cancel):

1. `POST /api/requests/:id/paid` as admin: 200, `paidAt` is non-null,
   audit log row written with `action: 'paid'`.
2. `POST /api/requests/:id/paid` as non-admin member: 403.
3. `POST /api/requests/:id/unpaid` as admin reverts `paidAt` to null,
   writes audit log row with `action: 'unpaid'`.
4. Marking paid on a `cancelled` request: 200 (no status gate — proves
   the no-gating design).
5. Idempotency: marking paid twice in a row returns 200 both times;
   `paidAt` doesn't change between calls.

Frontend tests remain out-of-scope (no test scaffolding in
`apps/frontend` yet — same as the order-chat feature).

## Rollout

Single PR. Schema-additive, no backfill, zero-downtime deploy.
Existing orders get `paidAt: null` on migration — they show as
unpaid until admin marks them. That matches reality.

## Forward compatibility with Stripe (out of scope, but noted)

When the owner later sets up Stripe (Level 3 in our brainstorm — hosted
Payment Links), the migration path is:

1. Add `paymentLinkId`, `paymentLinkUrl`, `stripeSessionId` columns to
   `Request` (additive).
2. The `accept-request` handler also creates a Payment Link.
3. A new webhook endpoint receives `checkout.session.completed` and
   sets `paidAt = event.created` — **same column this spec adds**.
4. The admin "Mark paid" button stays as the fallback / manual override.

No data migration required at that point; this design's `paidAt` is
the single source of truth either way.

## Open questions

None. Decided in brainstorming Q1 (Level 1) and Q2 (no Complete gate).
