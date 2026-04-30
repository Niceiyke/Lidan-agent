import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { AppVariables } from '../index.js';
import { addTaskJob } from '../queue.js';

const goals = new Hono();

// Schema for validation
const createGoalSchema = z.object({
  goal: z.string().min(1),
  requirements: z.string().optional(),
  agentId: z.string().optional(),
});

// ============================================
// Create Goal (creates project + plan)
// ============================================

goals.post('/', async (c) => {
  let goal: string;
  let requirements: string | undefined;
  let agentId: string | undefined;
  
  try {
    const body = await c.req.json();
    goal = body.goal;
    requirements = body.requirements;
    agentId = body.agentId;
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  
  if (!goal || typeof goal !== 'string') {
    return c.json({ error: 'goal is required' }, 400);
  }
  
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const orchestrator = (c as any).orchestrator;

  if (!orchestrator) {
    return c.json({ error: 'Orchestrator not initialized' }, 500);
  }

  try {
    // Create project with workspace
    const project = await orchestrator.createProject(
      extractProjectName(goal),
      goal
    );

    sse.broadcast('project:created', {
      projectId: project.id,
      name: project.name,
    });

    // Create the planning task
    const plan = await prisma.taskPlan.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      return c.json({ error: 'Failed to create plan' }, 500);
    }

    // Create initial planning task
    const planningTask = await prisma.task.create({
      data: {
        id: uuid(),
        planId: plan.id,
        type: 'planning',
        title: `Plan: ${project.name}`,
        description: goal,
        status: 'pending',
        priority: 'critical',
      },
    });

    sse.broadcast('task:created', {
      taskId: planningTask.id,
      projectId: project.id,
      type: 'planning',
    });

    // Queue the planning task
    await addTaskJob({
      taskId: planningTask.id,
      projectId: project.id,
      planId: plan.id,
      type: 'planning',
      title: planningTask.title,
      description: planningTask.description,
      priority: 'critical',
    });

    sse.broadcast('task:queued', { taskId: planningTask.id });

    // Update project status to building
    await orchestrator.updateProjectStatus(project.id, 'building');

    return c.json({
      projectId: project.id,
      planId: plan.id,
      taskId: planningTask.id,
      workspacePath: project.workspacePath,
    }, 201);
  } catch (error) {
    console.error('Failed to create goal:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to create goal'
    }, 500);
  }
});

// ============================================
// Get Goal/Plan
// ============================================

goals.get('/:planId', async (c) => {
  const prisma = c.get('prisma');
  const { planId } = c.req.param();

  const plan = await prisma.taskPlan.findUnique({
    where: { id: planId },
    include: {
      project: true,
      tasks: {
        include: {
          assignedAgent: true,
          parent: true,
          children: true,
          dependencies: {
            include: {
              dependsOn: true,
            },
          },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });

  if (!plan) {
    return c.json({ error: 'Plan not found' }, 404);
  }

  return c.json({ plan });
});

// ============================================
// List Goals/Plans
// ============================================

goals.get('/', async (c) => {
  const prisma = c.get('prisma');
  const projectId = c.req.query('projectId');
  const status = c.req.query('status');

  const where: any = {};
  if (projectId) where.projectId = projectId;

  const plans = await prisma.taskPlan.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      tasks: {
        select: {
          id: true,
          type: true,
          status: true,
          priority: true,
        },
      },
      _count: {
        select: {
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return c.json({ plans });
});

// ============================================
// Delete Plan
// ============================================

goals.delete('/:planId', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { planId } = c.req.param();

  try {
    await prisma.taskPlan.delete({
      where: { id: planId },
    });

    sse.broadcast('plan:deleted', { planId });

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete plan'
    }, 500);
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Extract a project name from a goal description
 */
function extractProjectName(goal: string): string {
  // Try to extract meaningful name from goal
  const cleaned = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4)
    .join('-');
  
  if (cleaned.length > 0) {
    return cleaned;
  }
  
  // Fallback to generated name
  return `project-${uuid().slice(0, 8)}`;
}

export default goals;
