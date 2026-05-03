# Operations

## Production deploy (S2)

Mirrors the dinner-club pattern documented in `/d/docs/mikrotik/CLAUDE.md` ("Adding a new app").

### One-time setup

1. **Postgres user + DB** on `shared-infra`:
   ```bash
   docker exec shared-infra-postgresql-1 psql -U postgres -c "
     CREATE USER velvet_scoop WITH PASSWORD '<strong-password>';
     CREATE DATABASE velvet_scoop OWNER velvet_scoop;"
   docker exec shared-infra-postgresql-1 psql -U postgres -d velvet_scoop -c "
     GRANT ALL PRIVILEGES ON SCHEMA public TO velvet_scoop;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO velvet_scoop;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO velvet_scoop;"
   ```

2. **Vault policy + secrets** (LC3, root token):
   ```bash
   vault policy write velvet-scoop - <<'EOF'
   path "secret/data/velvet-scoop" { capabilities = ["read"] }
   EOF
   vault kv put secret/velvet-scoop \
     DATABASE_URL='postgres://velvet_scoop:<pwd>@postgresql/velvet_scoop' \
     REDIS_URL='redis://redis:6379' \
     SESSION_SECRET='<openssl rand -base64 48>' \
     SESSION_COOKIE_SECURE='true' \
     FRONTEND_ORIGIN='https://velvet-scoop.wispy-nook.casa' \
     AUTHENTIK_ISSUER_URL='https://authentik.wispy-nook.casa/application/o/velvet-scoops/' \
     AUTHENTIK_CLIENT_ID='<from authentik provider>' \
     AUTHENTIK_CLIENT_SECRET='<from authentik provider>' \
     AUTHENTIK_REDIRECT_URI='https://velvet-scoop.wispy-nook.casa/api/auth/callback' \
     AUTHENTIK_MEMBER_GROUP='velvet-scoop-users' \
     AUTHENTIK_ADMIN_GROUP='velvet-scoop-admins'
   ```

3. **Vault token** (LC3):
   ```bash
   bash /opt/vault/add-app-token.sh velvet-scoop velvet-scoop
   ```
   Copy the printed token to S2.

4. **Authentik provider**: OAuth2/OIDC, Confidential client, redirect URI exactly `https://velvet-scoop.wispy-nook.casa/api/auth/callback`. Bind groups `velvet-scoop-users` and `velvet-scoop-admins` to the application.

5. **Clone repo on S2** (as `runner` user):
   ```bash
   sudo install -d -o runner -g runner /opt/velvet-scoop
   sudo -u runner git clone git@github.com:Zaphiruz/velvet-scoop.git /opt/velvet-scoop
   echo 'VAULT_ADDR=https://vault.wispy-nook.casa' > /opt/velvet-scoop/.env
   echo 'VAULT_TOKEN=<token from step 3>' >> /opt/velvet-scoop/.env
   chmod 400 /opt/velvet-scoop/.env
   chown runner:runner /opt/velvet-scoop/.env
   ```

6. **GitHub Actions self-hosted runner**: register at `/opt/actions-runner-velvet-scoop` per the standard pattern in `CLAUDE.md`. Service name will be `actions.runner.Zaphiruz-velvet-scoop.S2`.

7. **Cloudflare Tunnel**: add public hostname `velvet-scoop.wispy-nook.casa` → `https://localhost:443`, Origin Server Name `velvet-scoop.wispy-nook.casa`.

8. **nginx on LC2**: add server block to `/etc/nginx/sites-enabled/wispy-nook.casa`:
   ```nginx
   server {
     listen 443 ssl;
     server_name velvet-scoop.wispy-nook.casa;
     ssl_certificate     /etc/nginx/certs/cloudflare-origin.pem;
     ssl_certificate_key /etc/nginx/certs/cloudflare-origin.key;
     location / {
       proxy_pass http://192.168.40.20:3006;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
   Then `nginx -t && systemctl reload nginx`.

### Deploy

Push to `main` — the self-hosted runner pulls, builds, brings the stack up, and runs Prisma migrations against the Vault-supplied `DATABASE_URL`.

Manual equivalent (run on S2 as `runner`):
```bash
cd /opt/velvet-scoop
git pull
docker compose -f docker-compose.prod.yml build backend frontend
docker compose -f docker-compose.prod.yml up -d
source .env
DB_URL=$(curl -sf -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/secret/data/velvet-scoop" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['data']['DATABASE_URL'])")
docker exec -e DATABASE_URL="$DB_URL" velvet-scoop-backend-1 \
  apps/backend/node_modules/.bin/prisma migrate deploy \
  --schema apps/backend/prisma/schema.prisma
```

## Architecture in one screen

- **Backend** (`apps/backend`): Fastify + Prisma + ioredis + openid-client (Authentik OIDC). Listens on `:3000` inside the container, not exposed to the host. Connects to `postgresql` (shared-db) and `redis` (shared-redis) by alias.
- **Frontend** (`apps/frontend`): Vite-built React SPA served by Caddy. Caddy reverse-proxies `/api/*` to `backend:3000` and falls back to `index.html` for SPA routes. Container exposes `:80`, host binds `:3006`.
- **Secrets**: backend's `entrypoint.mjs` fetches `secret/data/velvet-scoop` from Vault on startup. Only `VAULT_ADDR` and `VAULT_TOKEN` live in the on-disk `.env`.
- **Routing**: Cloudflare Tunnel → nginx on LC2 (TLS + SNI) → S2:3006 → Caddy → backend.

## Local dev

```bash
# Postgres + Redis (port-remapped 5433/6380 to avoid clashes with dinner-club)
docker compose up -d postgres redis

# Backend (terminal 1) — picks up .env automatically via dotenv
pnpm --filter @velvet-scoop/backend dev

# Frontend (terminal 2)
pnpm --filter @velvet-scoop/frontend dev
# Vite serves on http://localhost:5180, proxies /api → 127.0.0.1:3000
```

## Tests

```bash
# One-time: create the test database and apply migrations
pnpm --filter @velvet-scoop/backend test:db:setup

# Run
pnpm --filter @velvet-scoop/backend test
```
