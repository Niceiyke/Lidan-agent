import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { AppVariables } from '../index.js';
import { addExecutionJob } from '../queue.js';

const executions = new Hono();

// Schema for validation
const createExecutionSchema = z.object({
  containerId: z.string(),
  taskId: z.string().optional(),
  type: z.enum(['build', 'test', 'lint', 'execute', 'install']),
  command: z.string(),
  timeout: z.number().optional(),
});

// ============================================
// Create Execution
// ============================================

executions.post('/', zValidator('json', createExecutionSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { containerId, taskId, type, command, timeout } = c.req.valid();

  const executionId = uuid();

  // Create execution record
  const execution = await prisma.execution.create({
    data: {
      id: executionId,
      containerId,
      taskId,
      type,
      command,
      status: 'running',
      timeout: timeout ? timeout * 1000 : undefined,
    },
  });

  sse.broadcast('execution:created', execution);

  // Queue the execution
  await addExecutionJob({
    executionId,
    containerId,
    taskId,
    type,
    command,
    timeout,
  });

  sse.broadcast('execution:queued', { executionId });

  return c.json({ execution }, 201);
});

// ============================================
// Get Execution
// ============================================

executions.get('/:executionId', async (c) => {
  const prisma = c.get('prisma');
  const { executionId } = c.req.param();

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: {
      container: {
        select: {
          id: true,
          name: true,
          projectId: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
    },
  });

  if (!execution) {
    return c.json({ error: 'Execution not found' }, 404);
  }

  return c.json({ execution });
});

// ============================================
// List Executions
// ============================================

executions.get('/', async (c) => {
  const prisma = c.get('prisma');
  const containerId = c.req.query('containerId');
  const taskId = c.req.query('taskId');
  const status = c.req.query('status');
  const type = c.req.query('type');

  const where: any = {};
  if (containerId) where.containerId = containerId;
  if (taskId) where.taskId = taskId;
  if (status) where.status = status;
  if (type) where.type = type;

  const executions = await prisma.execution.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return c.json({ executions });
});

// ============================================
// Get Execution Output
// ============================================

executions.get('/:executionId/output', async (c) => {
  const prisma = c.get('prisma');
  const { executionId } = c.req.param();

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    select: {
      id: true,
      output: true,
      status: true,
      exitCode: true,
    },
  });

  if (!execution) {
    return c.json({ error: 'Execution not found' }, 404);
  }

  return c.json({
    executionId: execution.id,
    output: execution.output || '',
    status: execution.status,
    exitCode: execution.exitCode,
  });
});

// ============================================
// Cancel Execution
// ============================================

executions.post('/:executionId/cancel', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { executionId } = c.req.param();

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });

  if (!execution) {
    return c.json({ error: 'Execution not found' }, 404);
  }

  if (execution.status !== 'running') {
    return c.json({ error: 'Execution is not running' }, 400);
  }

  // Update status
  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status: 'cancelled',
      finishedAt: new Date(),
    },
  });

  sse.broadcast('execution:cancelled', { executionId });

  return c.json({ success: true });
});

export default executions;
