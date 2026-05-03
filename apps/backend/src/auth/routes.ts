import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { OidcClient } from './oidc.js';
import type { SessionStore } from './session.js';
import { NotMemberError, syncRole, type RoleSyncConfig } from './role-sync.js';

export interface AuthRouteDeps {
  prisma: PrismaClient;
  sessionStore: SessionStore;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  oidcClient: OidcClient;
  authentikGroups: RoleSyncConfig;
  frontendOrigin: string;
  cookieSecure: boolean;
  rateLimitEnabled?: boolean;
}

interface PkceCookiePayload {
  state: string;
  nonce: string;
  codeVerifier: string;
}

const PKCE_COOKIE = 'vs_oidc';
const PKCE_MAX_AGE_SECONDS = 600;

function encodePkce(payload: PkceCookiePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodePkce(value: string): PkceCookiePayload | null {
  try {
    const json = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as PkceCookiePayload;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.codeVerifier !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  // Stricter rate limit on the unauth'd OIDC entrypoints — login + callback
  // are the most attractive targets for hammering with state-cookie probes
  // and token-exchange spam.
  const authRouteConfig = deps.rateLimitEnabled
    ? { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }
    : {};

  app.get('/api/auth/login', authRouteConfig, async (_req, reply) => {
    const artifacts = await deps.oidcClient.authorizationUrl();
    const cookieValue = encodePkce({
      state: artifacts.state,
      nonce: artifacts.nonce,
      codeVerifier: artifacts.codeVerifier,
    });
    reply.setCookie(PKCE_COOKIE, cookieValue, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: deps.cookieSecure,
      signed: true,
      maxAge: PKCE_MAX_AGE_SECONDS,
    });
    return reply.redirect(artifacts.url);
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/auth/callback',
    authRouteConfig,
    async (req, reply) => {
      const { code, state, error } = req.query;
      if (error) {
        return reply.code(400).send({
          error: { code: 'OIDC_ERROR', message: `Provider returned: ${error}` },
        });
      }
      if (!code || !state) {
        return reply.code(400).send({
          error: { code: 'BAD_REQUEST', message: 'Missing code or state' },
        });
      }
      const rawCookie = req.cookies[PKCE_COOKIE];
      if (!rawCookie) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'Missing state cookie' } });
      }
      const unsigned = req.unsignCookie(rawCookie);
      if (!unsigned.valid || unsigned.value === null) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'Invalid state cookie' } });
      }
      const payload = decodePkce(unsigned.value);
      if (!payload || payload.state !== state) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'State mismatch' } });
      }

      let userinfo;
      try {
        userinfo = await deps.oidcClient.exchange({
          code,
          state: payload.state,
          nonce: payload.nonce,
          codeVerifier: payload.codeVerifier,
        });
      } catch (err) {
        req.log?.error({ err }, 'oidc exchange failed');
        return reply.code(400).send({ error: { code: 'OIDC_EXCHANGE_FAILED', message: 'Token exchange failed' } });
      }

      let role;
      try {
        ({ role } = syncRole(userinfo.groups, deps.authentikGroups));
      } catch (err) {
        if (err instanceof NotMemberError) {
          return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Not a member' } });
        }
        throw err;
      }

      const displayName =
        userinfo.name?.trim() || userinfo.preferred_username?.trim() || userinfo.email || userinfo.sub;

      const user = await deps.prisma.user.upsert({
        where: { authentikSub: userinfo.sub },
        create: {
          authentikSub: userinfo.sub,
          email: userinfo.email,
          displayName,
          role,
        },
        update: {
          email: userinfo.email,
          displayName,
          role,
        },
      });

      if (user.deletedAt) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Account deleted' } });
      }
      if (user.banned) {
        return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Account banned' } });
      }

      reply.clearCookie(PKCE_COOKIE, { path: '/api/auth' });

      const sessionId = await deps.sessionStore.create(user.id);
      reply.setCookie(deps.sessionCookieName, sessionId, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: deps.cookieSecure,
        maxAge: deps.sessionTtlSeconds,
      });

      return reply.redirect(`${deps.frontendOrigin}/`);
    },
  );

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies[deps.sessionCookieName];
    if (sid) {
      await deps.sessionStore.destroy(sid);
    }
    reply.clearCookie(deps.sessionCookieName, { path: '/' });

    let endSessionUrl: string | null = null;
    if (deps.oidcClient.endSessionUrl) {
      endSessionUrl = await deps.oidcClient.endSessionUrl({
        postLogoutRedirectUri: deps.frontendOrigin,
      });
    }

    return { data: { ok: true, endSessionUrl } };
  });

  app.get('/api/auth/me', { preHandler: app.requireAuth }, async (req, reply) => {
    if (!req.user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'No user' } });
    }
    return {
      data: {
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
        role: req.user.role,
        muted: req.user.muted,
        banned: req.user.banned,
      },
    };
  });
}
