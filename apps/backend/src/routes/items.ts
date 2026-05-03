import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { writeAudit } from '../services/audit.js';

export interface ItemRouteDeps {
  prisma: PrismaClient;
}

interface ItemBody {
  name?: string;
  description?: string;
  nutritionalFacts?: string;
  ingredients?: string;
  allergyInformation?: string;
  isSeasonal?: boolean;
  cost?: number | string;
  active?: boolean;
}

function isValidCost(v: unknown): v is number | string {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return true;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) return true;
  return false;
}

export function registerItemRoutes(app: FastifyInstance, deps: ItemRouteDeps): void {
  app.get<{ Querystring: { include_inactive?: string } }>(
    '/api/items',
    { preHandler: app.requireAuth },
    async (req) => {
      const includeInactive = req.query.include_inactive === '1' && req.user?.role === 'admin';
      const where: Prisma.ItemWhereInput = {
        deletedAt: null,
        ...(includeInactive ? {} : { active: true }),
      };
      const items = await deps.prisma.item.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      return { data: items };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/items/:id',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const item = await deps.prisma.item.findUnique({ where: { id: req.params.id } });
      if (!item || item.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
      }
      return { data: item };
    },
  );

  const adminHook = async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireAuth(req, reply);
    if (reply.sent) return;
    await app.requireAdmin(req, reply);
  };

  app.post<{ Body: ItemBody }>('/api/items', { preHandler: adminHook }, async (req, reply) => {
    const body = req.body ?? {};
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'name is required' } });
    }
    if (!body.description || typeof body.description !== 'string') {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'description is required' } });
    }
    if (body.cost === undefined || body.cost === null) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'cost is required' } });
    }
    if (!isValidCost(body.cost)) {
      return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'cost must be a non-negative number' } });
    }
    const created = await deps.prisma.item.create({
      data: {
        name: body.name.trim(),
        description: body.description,
        nutritionalFacts: body.nutritionalFacts ?? '',
        ingredients: body.ingredients ?? '',
        allergyInformation: body.allergyInformation ?? '',
        isSeasonal: body.isSeasonal ?? false,
        cost: body.cost.toString(),
        active: body.active ?? true,
      },
    });
    await writeAudit(deps.prisma, {
      actorId: req.user!.id,
      entityType: 'Item',
      entityId: created.id,
      action: 'create',
    });
    reply.code(201);
    return { data: created };
  });

  app.patch<{ Params: { id: string }; Body: ItemBody }>(
    '/api/items/:id',
    { preHandler: adminHook },
    async (req, reply) => {
      const item = await deps.prisma.item.findUnique({ where: { id: req.params.id } });
      if (!item || item.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
      }
      const body = req.body ?? {};
      const data: Prisma.ItemUpdateInput = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.nutritionalFacts !== undefined) data.nutritionalFacts = body.nutritionalFacts;
      if (body.ingredients !== undefined) data.ingredients = body.ingredients;
      if (body.allergyInformation !== undefined) data.allergyInformation = body.allergyInformation;
      if (body.isSeasonal !== undefined) data.isSeasonal = body.isSeasonal;
      if (body.cost !== undefined) {
        if (!isValidCost(body.cost)) {
          return reply.code(400).send({ error: { code: 'BAD_REQUEST', message: 'cost must be a non-negative number' } });
        }
        data.cost = body.cost.toString();
      }
      if (body.active !== undefined) data.active = body.active;
      const updated = await deps.prisma.item.update({ where: { id: item.id }, data });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Item',
        entityId: item.id,
        action: 'edit',
        metadata: { fields: Object.keys(data) },
      });
      return { data: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/items/:id',
    { preHandler: adminHook },
    async (req, reply) => {
      const item = await deps.prisma.item.findUnique({ where: { id: req.params.id } });
      if (!item || item.deletedAt) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Item not found' } });
      }
      await deps.prisma.item.update({
        where: { id: item.id },
        data: { deletedAt: new Date(), active: false },
      });
      await writeAudit(deps.prisma, {
        actorId: req.user!.id,
        entityType: 'Item',
        entityId: item.id,
        action: 'delete',
      });
      return { data: { ok: true } };
    },
  );
}
