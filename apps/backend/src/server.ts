import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { getPrisma } from './db.js';

async function main() {
  const cfg = loadConfig();
  const prisma = getPrisma();

  const app = await buildApp({
    logger: true,
    prisma,
    cookieSecret: cfg.session.secret,
    frontendOrigin: cfg.frontendOrigin,
  });

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
