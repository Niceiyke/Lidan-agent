import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { AppVariables } from '../index.js';
import { addTaskJob, cancelJob } from '../queue.js';

const tasks = new Hono();

// Schema for validation
const createTaskSchema = z.object({
  planId: z.string(),
  type: z.enum(['planning', 'coding', 'review', 'testing', 'debugging']),
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  parentTaskId: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

const updateTaskSchema = z.object({
  status: z.enum(['pending', 'queued', 'running', 'done', 'failed', 'blocked', 'cancelled']).optional(),
  assignedAgentId: z.string().optional(),
});

// ============================================
// Create Task
// ============================================

tasks.post('/', zValidator('json', createTaskSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { planId, type, title, description, priority, parentTaskId, dependencies } = c.req.valid();

  // Get plan to get projectId
  const plan = await prisma.taskPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404);
  }

  // Create task
  const task = await prisma.task.create({
    data: {
      id: uuid(),
      planId,
      type,
      title,
      description: description || title,
      status: 'pending',
      priority,
      parentTaskId,
    },
  });

  // Create dependencies
  if (dependencies && dependencies.length > 0) {
    await prisma.taskDependency.createMany({
      data: dependencies.map(depId => ({
        taskId: task.id,
        dependsOnTaskId: depId,
      })),
    });
  }

  sse.broadcast('task:created', {
    taskId: task.id,
    projectId: plan.projectId,
    type,
  });

  return c.json({ task }, 201);
});

// ============================================
// Get Task
// ============================================

tasks.get('/:taskId', async (c) => {
  const prisma = c.get('prisma');
  const { taskId } = c.req.param();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedAgent: true,
      parent: true,
      children: true,
      dependencies: {
        include: {
          dependsOn: true,
        },
      },
      dependents: {
        include: {
          task: true,
        },
      },
      executions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      plan: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              workspacePath: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({ task });
});

// ============================================
// List Tasks
// ============================================

tasks.get('/', async (c) => {
  const prisma = c.get('prisma');
  const planId = c.req.query('planId');
  const projectId = c.req.query('projectId');
  const status = c.req.query('status');
  const type = c.req.query('type');
  const assignedAgentId = c.req.query('assignedAgentId');

  const where: any = {};
  if (planId) where.planId = planId;
  if (status) where.status = status;
  if (type) where.type = type;
  if (assignedAgentId) where.assignedAgentId = assignedAgentId;

  // If projectId provided, find all plans for that project
  if (projectId) {
    const plans = await prisma.taskPlan.findMany({
      where: { projectId },
      select: { id: true },
    });
    where.planId = { in: plans.map(p => p.id) };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignedAgent: {
        select: {
          id: true,
          name: true,
          role: true,
          status: true,
        },
      },
      parent: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
      _count: {
        select: {
          children: true,
          dependents: true,
        },
      },
    },
    orderBy: [
      { priority: 'asc' },
      { createdAt: 'asc' },
    ],
    take: 100,
  });

  return c.json({ tasks });
});

// ============================================
// Update Task
// ============================================

tasks.patch('/:taskId', zValidator('json', updateTaskSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { taskId } = c.req.param();
  const { status, assignedAgentId } = c.req.valid();

  try {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(status && { status }),
        ...(assignedAgentId && { assignedAgentId }),
      },
      include: {
        plan: {
          include: {
            project: true,
          },
        },
      },
    });

    sse.broadcast('task:updated', {
      taskId,
      status,
      assignedAgentId,
    });

    // If status changed to queued, add to job queue
    if (status === 'queued') {
      await addTaskJob({
        taskId: task.id,
        projectId: task.plan.projectId,
        planId: task.planId,
        type: task.type as any,
        title: task.title,
        description: task.description,
        priority: task.priority as any,
        parentTaskId: task.parentTaskId || undefined,
      });

      sse.broadcast('task:queued', { taskId });
    }

    return c.json({ task });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to update task'
    }, 500);
  }
});

// ============================================
// Queue Task
// ============================================

tasks.post('/:taskId/queue', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { taskId } = c.req.param();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      plan: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  if (task.status !== 'pending') {
    return c.json({ error: 'Task must be pending to queue' }, 400);
  }

  // Update status to queued
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'queued' },
  });

  // Add to job queue
  const jobId = await addTaskJob({
    taskId: task.id,
    projectId: task.plan.projectId,
    planId: task.planId,
    type: task.type as any,
    title: task.title,
    description: task.description,
    priority: task.priority as any,
    parentTaskId: task.parentTaskId || undefined,
  });

  sse.broadcast('task:queued', { taskId, jobId });

  return c.json({ success: true, jobId });
});

// ============================================
// Cancel Task
// ============================================

tasks.post('/:taskId/cancel', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { taskId } = c.req.param();

  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  // Cancel in queue if queued
  if (task.status === 'queued') {
    await cancelJob(taskId);
  }

  // Update status
  await prisma.task.update({
    where: { id: taskId },
    data: { status: 'cancelled' },
  });

  sse.broadcast('task:cancelled', { taskId });

  return c.json({ success: true });
});

// ============================================
// Delete Task
// ============================================

tasks.delete('/:taskId', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { taskId } = c.req.param();

  try {
    await prisma.task.delete({
      where: { id: taskId },
    });

    sse.broadcast('task:deleted', { taskId });

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete task'
    }, 500);
  }
});

// ============================================
// Get Task Dependencies
// ============================================

tasks.get('/:taskId/dependencies', async (c) => {
  const prisma = c.get('prisma');
  const { taskId } = c.req.param();

  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOn: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
    },
  });

  return c.json({ dependencies });
});

// ============================================
// Get Task Executions
// ============================================

tasks.get('/:taskId/executions', async (c) => {
  const prisma = c.get('prisma');
  const { taskId } = c.req.param();

  const executions = await prisma.execution.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ executions });
});

export default tasks;
