import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { getPrisma } from './db.js';
import { getRedis } from './redis.js';
import { createSessionStore } from './auth/session.js';
import { createOidcClient } from './auth/oidc.js';

async function main() {
  const cfg = loadConfig();
  const prisma = getPrisma();
  const redis = getRedis(cfg.redisUrl);
  const sessionStore = createSessionStore(redis, { ttlSeconds: cfg.session.ttlSeconds });
  const oidcClient = createOidcClient({
    issuer: cfg.oidc.issuer,
    clientId: cfg.oidc.clientId,
    clientSecret: cfg.oidc.clientSecret,
    redirectUri: cfg.oidc.redirectUri,
  });

  const app = await buildApp({
    logger: true,
    prisma,
    sessionStore,
    sessionCookieName: cfg.session.cookieName,
    sessionSecret: cfg.session.secret,
    sessionTtlSeconds: cfg.session.ttlSeconds,
    cookieSecure: cfg.session.cookieSecure,
    oidcClient,
    authentikGroups: {
      memberGroup: cfg.authentik.memberGroup,
      adminGroup: cfg.authentik.adminGroup,
    },
    frontendOrigin: cfg.frontendOrigin,
  });

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
