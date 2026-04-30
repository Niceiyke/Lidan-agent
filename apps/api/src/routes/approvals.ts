import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

const approvals = new Hono();

approvals.get('/', async (c) => {
  const { prisma } = c.var;
  const approvals = await prisma.approvalRequest.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' }
  });
  return c.json({ approvals });
});

approvals.post('/', zValidator('json', z.object({
  agentId: z.string(),
  taskId: z.string(),
  action: z.string(),
  description: z.string(),
  payload: z.record(z.unknown())
})), async (c) => {
  const { prisma, sse } = c.var;
  const { agentId, taskId, action, description, payload } = c.req.valid();
  const approval = await prisma.approvalRequest.create({
    data: { id: uuid(), agentId, taskId, action, description, payload, status: 'pending' }
  });
  sse.broadcast('approval:requested', approval);
  return c.json({ approval }, 201);
});

approvals.patch('/:id', zValidator('json', z.object({
  status: z.enum(['approved', 'rejected'])
})), async (c) => {
  const { prisma, sse } = c.var;
  const approval = await prisma.approvalRequest.update({
    where: { id: c.req.param('id') },
    data: { status: c.req.valid().status }
  });
  sse.broadcast('approval:resolved', approval);
  return c.json({ approval });
});

export default approvals;
