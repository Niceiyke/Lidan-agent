/**
 * Git Branch Management Routes
 * 
 * API for listing, creating, and managing git branches
 */

import { Hono } from 'hono';
import { WorktreeManager } from '../git/worktree-manager.js';
import { prisma } from '../index.js';

const app = new Hono();

// Lazy-initialize worktree manager
let _worktreeManager: WorktreeManager | null = null;

function getWorktreeManager(workspacesPath: string): WorktreeManager {
  if (!_worktreeManager || _worktreeManager['basePath'] !== workspacesPath) {
    _worktreeManager = new WorktreeManager(workspacesPath);
  }
  return _worktreeManager;
}

/**
 * Get workspace path from prisma
 */
function getWorkspacesPath(): string {
  return process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
}

/**
 * List all branches for a project
 * GET /api/projects/:projectId/branches
 */
app.get('/', async (c) => {
  const projectId = c.req.param('projectId');
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  try {
    const branches = await wm.listBranches(projectId);
    
    return c.json({
      projectId,
      branches,
      total: branches.length,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to list branches' 
    }, 500);
  }
});

/**
 * Get current branch for a project
 * GET /api/projects/:projectId/branches/current
 */
app.get('/current', async (c) => {
  const projectId = c.req.param('projectId');
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  try {
    const currentBranch = await wm.getCurrentBranch(projectId);
    
    return c.json({
      projectId,
      currentBranch,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get current branch' 
    }, 500);
  }
});

/**
 * Create a new branch
 * POST /api/projects/:projectId/branches
 */
app.post('/', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  const branchName = body.branchName;
  const baseBranch = body.baseBranch || 'main';
  
  if (!branchName) {
    return c.json({ error: 'branchName is required' }, 400);
  }
  
  // Sanitize branch name
  const sanitized = branchName.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
  
  try {
    const result = await wm.createBranch(projectId, sanitized, baseBranch);
    
    return c.json({
      success: true,
      projectId,
      branchName: sanitized,
      baseBranch,
      worktreePath: result.worktreePath,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create branch' 
    }, 500);
  }
});

/**
 * Switch to a branch
 * POST /api/projects/:projectId/branches/switch
 */
app.post('/switch', async (c) => {
  const projectId = c.req.param('projectId');
  const body = await c.req.json();
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  const branchName = body.branchName;
  
  if (!branchName) {
    return c.json({ error: 'branchName is required' }, 400);
  }
  
  try {
    await wm.switchBranch(projectId, branchName);
    
    return c.json({
      success: true,
      projectId,
      branchName,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to switch branch' 
    }, 500);
  }
});

/**
 * Delete a branch
 * DELETE /api/projects/:projectId/branches/:branchName
 */
app.delete('/:branchName', async (c) => {
  const projectId = c.req.param('projectId');
  const branchName = c.req.param('branchName');
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  // Prevent deleting main
  if (branchName === 'main' || branchName === 'master') {
    return c.json({ error: 'Cannot delete main branch' }, 400);
  }
  
  try {
    await wm.deleteBranch(projectId, branchName);
    
    return c.json({
      success: true,
      projectId,
      branchName,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete branch' 
    }, 500);
  }
});

/**
 * Get branch status (ahead/behind)
 * GET /api/projects/:projectId/branches/:branchName/status
 */
app.get('/:branchName/status', async (c) => {
  const projectId = c.req.param('projectId');
  const branchName = c.req.param('branchName');
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  try {
    const status = await wm.getBranchStatus(projectId, branchName);
    
    return c.json({
      projectId,
      branchName,
      ...status,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get branch status' 
    }, 500);
  }
});

/**
 * Get files changed in a branch
 * GET /api/projects/:projectId/branches/:branchName/files
 */
app.get('/:branchName/files', async (c) => {
  const projectId = c.req.param('projectId');
  const branchName = c.req.param('branchName');
  const baseBranch = c.req.query('base') || 'main';
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  try {
    const files = await wm.getChangedFiles(projectId, branchName, baseBranch);
    
    return c.json({
      projectId,
      branchName,
      baseBranch,
      files,
      total: files.length,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get changed files' 
    }, 500);
  }
});

/**
 * Compare two branches
 * GET /api/projects/:projectId/branches/compare?from=branch1&to=branch2
 */
app.get('/compare', async (c) => {
  const projectId = c.req.param('projectId');
  const fromBranch = c.req.query('from');
  const toBranch = c.req.query('to');
  const workspacesPath = getWorkspacesPath();
  const wm = getWorktreeManager(workspacesPath);
  
  if (!fromBranch || !toBranch) {
    return c.json({ error: 'from and to query params are required' }, 400);
  }
  
  try {
    const comparison = await wm.compareBranches(projectId, fromBranch, toBranch);
    
    return c.json({
      projectId,
      fromBranch,
      toBranch,
      ...comparison,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to compare branches' 
    }, 500);
  }
});

export default app;