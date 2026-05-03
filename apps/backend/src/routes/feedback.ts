import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { GithubClient } from '../services/github.js';

export interface FeedbackRouteDeps {
  prisma: PrismaClient;
  github: GithubClient;
}

const RATE_LIMIT = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
  createdAt: Date;
  state: string | null;
  stateReason: string | null;
  closedAt: Date | null;
};

function deriveStatus(state: string | null, stateReason: string | null): 'open' | 'done' | 'closed' {
  if (state !== 'closed') return 'open';
  if (stateReason === 'completed') return 'done';
  return 'closed';
}

function toResponseRow(row: Row) {
  const status = deriveStatus(row.state, row.stateReason);
  return {
    id: row.id,
    issueNumber: row.issueNumber,
    issueUrl: row.issueUrl,
    title: row.title,
    createdAt: row.createdAt,
    status,
    closedAt: status === 'open' ? null : row.closedAt,
  };
}

export function registerFeedbackRoutes(app: FastifyInstance, deps: FeedbackRouteDeps): void {
  app.post<{ Body: { body?: string; pageUrl?: string } }>(
    '/api/feedback',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const body = req.body?.body?.trim();
      if (!body) {
        return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'body is required' } });
      }

      const windowStart = new Date(Date.now() - WINDOW_MS);
      const recentCount = await deps.prisma.feedbackSubmission.count({
        where: { userId: req.user!.id, createdAt: { gte: windowStart } },
      });
      if (recentCount >= RATE_LIMIT) {
        return reply.code(429).send({
          error: { code: 'RATE_LIMITED', message: 'Too many submissions — try again tomorrow' },
        });
      }

      const title = body.length > 60 ? body.slice(0, 57) + '…' : body;
      const pageUrl = req.body?.pageUrl;
      const issueBody = [
        body,
        '',
        '---',
        `Submitted by **${req.user!.displayName}** (userId: ${req.user!.id})`,
        ...(pageUrl ? [`Page: ${pageUrl}`] : []),
      ].join('\n');

      const issue = await deps.github.createIssue({
        title,
        body: issueBody,
        labels: ['feedback', 'user-submitted'],
      });

      const submission = await deps.prisma.feedbackSubmission.create({
        data: {
          userId: req.user!.id,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          title,
        },
      });

      reply.code(201);
      return { data: { issueNumber: submission.issueNumber, issueUrl: submission.issueUrl } };
    },
  );

  app.get('/api/feedback/mine', { preHandler: app.requireAuth }, async (req) => {
    const submissions = await deps.prisma.feedbackSubmission.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        issueNumber: true,
        issueUrl: true,
        title: true,
        createdAt: true,
        state: true,
        stateReason: true,
        closedAt: true,
      },
    });

    // Lazy backfill: any row with no cached state gets one GitHub fetch on read.
    const needsFetch = submissions.filter((s) => s.state === null);
    if (needsFetch.length > 0) {
      const results = await Promise.allSettled(
        needsFetch.map((s) => deps.github.getIssue(s.issueNumber)),
      );
      for (let i = 0; i < needsFetch.length; i++) {
        const result = results[i];
        const row = needsFetch[i];
        if (!row || !result || result.status !== 'fulfilled') {
          if (result && result.status === 'rejected') {
            req.log.warn(
              { issueNumber: row?.issueNumber, err: result.reason },
              'feedback lazy backfill failed',
            );
          }
          continue;
        }
        const fetched = result.value;
        await deps.prisma.feedbackSubmission.update({
          where: { id: row.id },
          data: {
            state: fetched.state,
            stateReason: fetched.state_reason,
            closedAt: fetched.closed_at ? new Date(fetched.closed_at) : null,
            stateFetchedAt: new Date(),
          },
        });
        row.state = fetched.state;
        row.stateReason = fetched.state_reason;
        row.closedAt = fetched.closed_at ? new Date(fetched.closed_at) : null;
      }
    }

    return { data: submissions.map(toResponseRow) };
  });
}
