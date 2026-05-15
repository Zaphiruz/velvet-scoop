# Velvet Scoop

An ordering site for a small ice cream operation. Customers browse the flavors, place a request scheduled for a date and time, and chat with the team about their order. Owners run the admin side from the same app.

> Production: <https://velvet-scoops.wispy-nook.casa>

## Stack

- **Backend** (`apps/backend`): Fastify 5 + Prisma 5 + Postgres + Redis + openid-client (Authentik OIDC). Optional Resend SMTP for transactional email; optional VAPID web-push.
- **Frontend** (`apps/frontend`): React + Vite + Tailwind + Redux Toolkit Query. Served by Caddy in prod, by `vite dev` locally.
- **Shared** (`packages/shared`): cross-app type/utility helpers.
- **Monorepo**: pnpm workspaces; Node ≥ 20.10.

## Repo layout

```
apps/
  backend/      Fastify API + Prisma schema + migrations
  frontend/     React SPA
packages/
  shared/       shared types
docs/
  superpowers/  feature specs + implementation plans
docker-compose.yml          local dev (postgres:5433, redis:6380)
docker-compose.prod.yml     production stack
OPERATIONS.md   production deploy notes (Vault, Authentik, push, email)
```

## Features

- **Authentication** via Authentik OIDC. Sessions in Redis, HTTP-only cookies. Role sync from Authentik groups (`velvet-scoop-users` → member, `velvet-scoop-admins` → admin).
- **Items catalog**: admin CRUD; customers browse flavors with nutrition, ingredients, allergens, seasonal flag, soft-delete.
- **Order requests** with sequential `orderNumber` (e.g. `#42`) for payment correlation. Status flow: `pending` → `accepted` → `completed`, with cancel from either side under the right conditions.
- **Per-order chat threads** between the customer and the owner pool. Inline expand on the request card, 12-second polling, push wake, soft-delete own messages. Read-only on completed/cancelled orders.
- **Reviews** on completed orders with admin moderation.
- **Web push notifications** (VAPID) on order events and chat messages, plus email fallback via Resend SMTP. Both are opt-in at the operations layer.
- **In-app feedback widget** on Profile: writes a GitHub issue on `Zaphiruz/velvet-scoop` (optional, requires a fine-grained PAT in Vault).
- **Admin UI**: Items / Requests / Users tabs, including an "Owner" toggle that controls who receives owner notifications.

## Local dev quick-start

```bash
# 1. Start Postgres + Redis (port-remapped 5433/6380 to avoid host clashes)
docker compose up -d postgres redis

# 2. Apply migrations
pnpm prisma:migrate

# 3. Backend (terminal 1)
pnpm --filter @velvet-scoop/backend dev

# 4. Frontend (terminal 2)
pnpm --filter @velvet-scoop/frontend dev
# → http://localhost:5180 (proxies /api → :3000)
```

A `.env` file at the repo root is expected; see `OPERATIONS.md` for the full env surface. Many env vars are optional (email, push, feedback) — the app degrades gracefully when they're absent.

## Tests

```bash
# One-time test DB setup
pnpm --filter @velvet-scoop/backend test:db:setup

# Run
pnpm --filter @velvet-scoop/backend test
pnpm -r typecheck
```

CI (`.github/workflows/ci.yml`) runs backend tests + docker build on every push to `main` and every PR.

## Deployment

See `OPERATIONS.md` for the full production deploy pattern (Vault, Authentik, nginx, Cloudflare Tunnel, self-hosted GitHub runner).

## Architecture docs

Design specs and implementation plans for individual features live in `docs/superpowers/`:

- `specs/` — design docs (decisions, non-goals, API shapes)
- `plans/` — task-by-task implementation plans

The most recent additions:

- [`2026-05-09-order-chat-design.md`](docs/superpowers/specs/2026-05-09-order-chat-design.md) — per-order customer ↔ owner-pool chat.
