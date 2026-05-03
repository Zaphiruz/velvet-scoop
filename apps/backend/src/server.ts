import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { disconnectPrisma, getPrisma } from './db.js';
import { disconnectRedis, getRedis } from './redis.js';
import { createSessionStore } from './auth/session.js';
import { createOidcClient } from './auth/oidc.js';
import { createGithubClient } from './services/github.js';

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

  const githubClient = cfg.github.feedbackToken
    ? createGithubClient({
        token: cfg.github.feedbackToken,
        owner: cfg.github.feedbackRepoOwner,
        repo: cfg.github.feedbackRepoName,
      })
    : undefined;

  const app = await buildApp({
    logger: true,
    prisma,
    redis,
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
    ...(githubClient ? { githubClient } : {}),
  });

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutdown signal received, draining');
    try {
      await app.close();
      await disconnectRedis();
      await disconnectPrisma();
      app.log.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  }
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
