import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { AppVariables } from '../index.js';

const agents = new Hono();

// Schema for validation
const createAgentSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  role: z.enum(['planner', 'coder', 'reviewer', 'tester', 'debugger']),
});

const updateAgentSchema = z.object({
  status: z.enum(['idle', 'planning', 'coding', 'reviewing', 'testing', 'debugging', 'waiting_approval', 'done', 'failed']).optional(),
  sessionId: z.string().optional(),
});

// ============================================
// Create Agent
// ============================================

agents.post('/', zValidator('json', createAgentSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { projectId, name, role } = c.req.valid();

  const agent = await prisma.agent.create({
    data: {
      id: uuid(),
      projectId,
      name,
      role,
      status: 'idle',
    },
  });

  sse.broadcast('agent:created', agent);

  return c.json({ agent }, 201);
});

// ============================================
// Get Agent
// ============================================

agents.get('/:agentId', async (c) => {
  const prisma = c.get('prisma');
  const { agentId } = c.req.param();

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      tasks: {
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      logs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({ agent });
});

// ============================================
// List Agents
// ============================================

agents.get('/', async (c) => {
  const prisma = c.get('prisma');
  const projectId = c.req.query('projectId');
  const role = c.req.query('role');
  const status = c.req.query('status');

  const where: any = {};
  if (projectId) where.projectId = projectId;
  if (role) where.role = role;
  if (status) where.status = status;

  const agents = await prisma.agent.findMany({
    where,
    include: {
      _count: {
        select: {
          tasks: true,
          logs: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return c.json({ agents });
});

// ============================================
// Update Agent
// ============================================

agents.patch('/:agentId', zValidator('json', updateAgentSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { agentId } = c.req.param();
  const { status, sessionId } = c.req.valid();

  try {
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(status && { status }),
        ...(sessionId && { sessionId }),
      },
    });

    sse.broadcast('agent:updated', { agentId, status, sessionId });

    return c.json({ agent });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to update agent'
    }, 500);
  }
});

// ============================================
// Delete Agent
// ============================================

agents.delete('/:agentId', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { agentId } = c.req.param();

  try {
    await prisma.agent.delete({
      where: { id: agentId },
    });

    sse.broadcast('agent:deleted', { agentId });

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete agent'
    }, 500);
  }
});

// ============================================
// Get Agent Tasks
// ============================================

agents.get('/:agentId/tasks', async (c) => {
  const prisma = c.get('prisma');
  const { agentId } = c.req.param();
  const status = c.req.query('status');

  const where: any = { assignedAgentId: agentId };
  if (status) where.status = status;

  const tasks = await prisma.task.findMany({
    where,
    include: {
      plan: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ tasks });
});

// ============================================
// Get Agent Logs
// ============================================

agents.get('/:agentId/logs', async (c) => {
  const prisma = c.get('prisma');
  const { agentId } = c.req.param();
  const level = c.req.query('level');
  const limit = parseInt(c.req.query('limit') || '100', 10);

  const where: any = { agentId };
  if (level) where.level = level;

  const logs = await prisma.executionLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return c.json({ logs });
});

// ============================================
// Create Agent Log
// ============================================

agents.post('/:agentId/logs', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { agentId } = c.req.param();
  const body = await c.req.json();
  const { level, message, taskId, metadata } = body;

  const log = await prisma.executionLog.create({
    data: {
      id: uuid(),
      agentId,
      taskId,
      level: level || 'info',
      message,
      metadata,
    },
  });

  sse.broadcast('agent:log', log);

  return c.json({ log }, 201);
});

export default agents;
