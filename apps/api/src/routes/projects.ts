import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type { AppVariables } from '../index.js';

const projects = new Hono();

// Schema for validation
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().min(1),
  userId: z.string().optional(),
});

const updateProjectSchema = z.object({
  status: z.enum(['planning', 'building', 'reviewing', 'done', 'failed']).optional(),
});

// ============================================
// Create Project
// ============================================

projects.post('/', zValidator('json', createProjectSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { name, goal, userId } = c.req.valid();

  try {
    const projectId = uuid();
    
    // Get orchestrator from app context (set in index.ts)
    const orchestrator = (c as any).orchestrator;
    
    if (!orchestrator) {
      return c.json({ error: 'Orchestrator not initialized' }, 500);
    }

    // Create project
    const project = await orchestrator.createProject(name, goal, userId);

    return c.json({ 
      projectId: project.id, 
      name: project.name,
      status: project.status,
      workspacePath: project.workspacePath,
    }, 201);
  } catch (error) {
    console.error('Failed to create project:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create project' 
    }, 500);
  }
});

// ============================================
// Get Project
// ============================================

projects.get('/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      plans: {
        include: {
          tasks: {
            include: {
              assignedAgent: true,
              children: true,
              dependencies: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      agents: {
        select: {
          id: true,
          name: true,
          role: true,
          status: true,
        },
      },
      containers: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Get git status
  const orchestrator = (c as any).orchestrator;
  let gitStatus = null;
  if (orchestrator) {
    try {
      gitStatus = await orchestrator.getProjectGitStatus(projectId);
    } catch {
      // Git status not available yet
    }
  }

  return c.json({
    project,
    gitStatus,
  });
});

// ============================================
// List Projects
// ============================================

projects.get('/', async (c) => {
  const prisma = c.get('prisma');
  const userId = c.req.query('userId') || 'default';
  const status = c.req.query('status');

  const where: any = { userId };
  if (status) {
    where.status = status;
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          agents: true,
          plans: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({ projects });
});

// ============================================
// Update Project Status
// ============================================

projects.patch('/:projectId', zValidator('json', updateProjectSchema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { projectId } = c.req.param();
  const { status } = c.req.valid();

  const orchestrator = (c as any).orchestrator;

  try {
    if (status && orchestrator) {
      await orchestrator.updateProjectStatus(projectId, status);
    } else {
      await prisma.project.update({
        where: { id: projectId },
        data: { status },
      });
    }

    sse.broadcast('project:updated', { projectId, status });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update project' 
    }, 500);
  }
});

// ============================================
// Delete Project
// ============================================

projects.delete('/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const { projectId } = c.req.param();

  const orchestrator = (c as any).orchestrator;

  try {
    // Cleanup resources
    if (orchestrator) {
      await orchestrator.cleanupProject(projectId);
    }

    // Delete project (cascade will handle related records)
    await prisma.project.delete({
      where: { id: projectId },
    });

    sse.broadcast('project:deleted', { projectId });

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete project' 
    }, 500);
  }
});

// ============================================
// Get Project Files
// ============================================

projects.get('/:projectId/files', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Build file tree from workspace
  // This would need actual file system access
  // For now, return empty tree structure
  return c.json({ 
    files: [],
    workspacePath: project.workspacePath,
  });
});

// ============================================
// Get Project Git Status
// ============================================

projects.get('/:projectId/git', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const orchestrator = (c as any).orchestrator;

  if (!orchestrator) {
    return c.json({ error: 'Orchestrator not available' }, 500);
  }

  try {
    const gitStatus = await orchestrator.getProjectGitStatus(projectId);
    return c.json({ gitStatus });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get git status' 
    }, 500);
  }
});

export default projects;
