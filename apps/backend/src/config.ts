export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  frontendOrigin: string;
  session: {
    secret: string;
    cookieName: string;
    cookieSecure: boolean;
    ttlSeconds: number;
  };
  oidc: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

export function loadConfig(): AppConfig {
  return {
    port: Number(optional('PORT', '3000')),
    nodeEnv: optional('NODE_ENV', 'development'),
    databaseUrl: required('DATABASE_URL'),
    redisUrl: required('REDIS_URL'),
    frontendOrigin: optional('FRONTEND_ORIGIN', 'http://localhost:5173'),
    session: {
      secret: required('SESSION_SECRET'),
      cookieName: optional('SESSION_COOKIE_NAME', 'velvetscoop_sid'),
      cookieSecure: parseBool(process.env['SESSION_COOKIE_SECURE'], false),
      ttlSeconds: Number(optional('SESSION_TTL_SECONDS', String(7 * 24 * 60 * 60))),
    },
    oidc: {
      issuer: optional('AUTHENTIK_ISSUER_URL'),
      clientId: optional('AUTHENTIK_CLIENT_ID'),
      clientSecret: optional('AUTHENTIK_CLIENT_SECRET'),
      redirectUri: optional('AUTHENTIK_REDIRECT_URI'),
    },
  };
}
