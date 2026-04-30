import { Hono } from 'hono';
import { promises as fs } from 'fs';
import { join, extname, relative } from 'path';
import { getFileWatcher } from '../storage/file-watcher.js';
import { WorktreeManager } from '../git/worktree-manager.js';

const files = new Hono();

// ============================================
// Get File Tree for a Project
// ============================================

files.get('/tree/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();
  const depth = parseInt(c.req.query('depth') || '3', 10);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const watcher = getFileWatcher();
  const tree = await watcher.buildFileTree(project.workspacePath, depth);

  return c.json({ files: tree, workspacePath: project.workspacePath });
});

// ============================================
// Get File Content
// ============================================

files.get('/content', async (c) => {
  const filePath = c.req.query('path');
  
  if (!filePath) {
    return c.json({ error: 'path parameter required' }, 400);
  }

  const content = await getFileWatcher().readFileContent(filePath);
  
  if (content === null) {
    return c.json({ error: 'File not found or unreadable' }, 404);
  }

  // Determine file type for syntax highlighting
  const ext = extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.sql': 'sql',
    '.prisma': 'text',
    '.sh': 'bash',
    '.yml': 'yaml',
    '.yaml': 'yaml',
  };

  return c.json({
    path: filePath,
    content,
    language: languageMap[ext] || 'text',
  });
});

// ============================================
// Write File Content
// ============================================

files.put('/content', async (c) => {
  const body = await c.req.json();
  const { path: filePath, content } = body;

  if (!filePath || content === undefined) {
    return c.json({ error: 'path and content required' }, 400);
  }

  const success = await getFileWatcher().writeFileContent(filePath, content);

  if (!success) {
    return c.json({ error: 'Failed to write file' }, 500);
  }

  return c.json({ success: true, path: filePath });
});

// ============================================
// Get Diff Between Worktree and Main
// ============================================

files.get('/diff/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();
  const taskId = c.req.query('taskId');
  const filePath = c.req.query('file');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  let worktreePath = project.workspacePath;

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { worktreePath: true },
    });
    
    if (task?.worktreePath) {
      worktreePath = task.worktreePath;
    }
  }

  try {
    const worktreeManager = new WorktreeManager(project.workspacePath);
    const diff = await worktreeManager.getDiff(worktreePath, filePath);

    return c.json({
      diff,
      worktreePath,
      projectPath: project.workspacePath,
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to get diff',
    }, 500);
  }
});

// ============================================
// Get List of Changed Files
// ============================================

files.get('/changes/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();
  const taskId = c.req.query('taskId');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  let worktreePath = project.workspacePath;

  if (taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { worktreePath: true },
    });
    
    if (task?.worktreePath) {
      worktreePath = task.worktreePath;
    }
  }

  try {
    const worktreeManager = new WorktreeManager(project.workspacePath);
    const status = await worktreeManager.getStatus(worktreePath);

    return c.json({
      files: status.files,
      branch: status.branch,
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, 500);
  }
});

// ============================================
// Watch Directory (Start File Watching)
// ============================================

files.post('/watch/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const watcher = getFileWatcher();
  await watcher.watchDirectory(project.workspacePath);

  return c.json({ success: true, path: project.workspacePath });
});

// ============================================
// Unwatch Directory
// ============================================

files.delete('/watch/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  const watcher = getFileWatcher();
  watcher.stopWatching(project.workspacePath);

  return c.json({ success: true });
});

// ============================================
// Get File Stats
// ============================================

files.get('/stats/:projectId', async (c) => {
  const prisma = c.get('prisma');
  const { projectId } = c.req.param();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspacePath: true },
  });

  if (!project) {
    return c.json({ error: 'Project not found' }, 404);
  }

  try {
    const stats = await getDirectoryStats(project.workspacePath);

    return c.json(stats);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to get stats',
    }, 500);
  }
});

// ============================================
// Helper Functions
// ============================================

async function getDirectoryStats(dirPath: string): Promise<{
  totalFiles: number;
  totalDirs: number;
  byType: Record<string, number>;
  sizeBytes: number;
}> {
  let totalFiles = 0;
  let totalDirs = 0;
  let sizeBytes = 0;
  const byType: Record<string, number> = {};

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          totalDirs++;
          await walk(join(dir, entry.name));
        } else {
          totalFiles++;
          
          const ext = extname(entry.name).toLowerCase() || 'no-ext';
          byType[ext] = (byType[ext] || 0) + 1;
          
          try {
            const stat = await fs.stat(join(dir, entry.name));
            sizeBytes += stat.size;
          } catch {
            // Ignore stat errors
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  await walk(dirPath);

  return { totalFiles, totalDirs, byType, sizeBytes };
}

export default files;
