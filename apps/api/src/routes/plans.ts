import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const plans = new Hono();

plans.get('/', async (c) => {
  const { prisma } = c.var;
  const plans = await prisma.taskPlan.findMany({ orderBy: { createdAt: 'desc' } });
  return c.json({ plans });
});

plans.post('/', zValidator('json', z.object({
  goal: z.string().min(1),
  requirements: z.string().optional()
})), async (c) => {
  const { prisma, sse } = c.var;
  const { goal, requirements } = c.req.valid();
  const plan = await prisma.taskPlan.create({
    data: { id: uuid(), goal, requirements }
  });
  sse.broadcast('plan:created', plan);
  return c.json({ plan }, 201);
});

plans.get('/:id', async (c) => {
  const { prisma } = c.var;
  const plan = await prisma.taskPlan.findUnique({ where: { id: c.req.param('id') } });
  if (!plan) return c.json({ error: 'Plan not found' }, 404);
  return c.json({ plan });
});

export default plans;
