/**
 * Diff Viewer Routes
 * 
 * API for viewing and comparing file changes
 */

import { Hono } from 'hono';
import { exec as execChildProcess } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

const exec = promisify(execChildProcess);
const app = new Hono();

function getWorkspacesPath(): string {
  return process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
}

/**
 * Get diff for a specific file between branches
 * GET /api/diff/project/:projectId/file?from=branch1&to=branch2&path=file.ts
 */
app.get('/project/:projectId/file', async (c) => {
  const projectId = c.req.param('projectId');
  const fromBranch = c.req.query('from') || 'main';
  const toBranch = c.req.query('to') || 'HEAD';
  const filePath = c.req.query('path');
  const workspacesPath = getWorkspacesPath();
  
  if (!filePath) {
    return c.json({ error: 'path query parameter is required' }, 400);
  }
  
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Use git diff for unified format
    const { stdout } = await exec(
      `git diff ${fromBranch}...${toBranch} -- "${filePath}"`,
      projectPath
    );
    
    // Parse diff into structured format
    const diff = parseDiffOutput(stdout, filePath);
    
    return c.json({
      projectId,
      filePath,
      from: fromBranch,
      to: toBranch,
      ...diff,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get diff' 
    }, 500);
  }
});

/**
 * Get diff for all files between branches
 * GET /api/diff/project/:projectId
 */
app.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const fromBranch = c.req.query('from') || 'main';
  const toBranch = c.req.query('to') || 'HEAD';
  const workspacesPath = getWorkspacesPath();
  
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Get summary stats
    const { stdout: stats } = await exec(
      `git diff --stat ${fromBranch}...${toBranch}`,
      projectPath
    ).catch(() => ({ stdout: '' }));
    
    // Get all changed files with status
    const { stdout: files } = await exec(
      `git diff --name-status ${fromBranch}...${toBranch}`,
      projectPath
    );
    
    const changedFiles = files
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [status, path] = line.split('\t');
        return { status, path };
      });
    
    // Get full diff for each file (limited)
    const fileDiffs = await Promise.all(
      changedFiles.slice(0, 20).map(async ({ status, path }) => {
        try {
          const { stdout } = await exec(
            `git diff ${fromBranch}...${toBranch} -- "${path}"`,
            projectPath
          );
          
          const parsed = parseDiffOutput(stdout, path);
          return { status, path, ...parsed };
        } catch {
          return { status, path, error: 'Failed to parse diff' };
        }
      })
    );
    
    return c.json({
      projectId,
      from: fromBranch,
      to: toBranch,
      totalFiles: changedFiles.length,
      stats: parseStatsLine(stats),
      files: fileDiffs,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get diff' 
    }, 500);
  }
});

/**
 * Get side-by-side diff (for display)
 * GET /api/diff/sidebyside/project/:projectId?from=branch1&to=branch2&path=file.ts
 */
app.get('/sidebyside/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const fromBranch = c.req.query('from') || 'main';
  const toBranch = c.req.query('to') || 'HEAD';
  const filePath = c.req.query('path');
  const workspacesPath = getWorkspacesPath();
  
  if (!filePath) {
    return c.json({ error: 'path query parameter is required' }, 400);
  }
  
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Get the actual file content from both branches
    const fromContent = await getFileAtRef(projectPath, fromBranch, filePath);
    const toContent = await getFileAtRef(projectPath, toBranch, filePath);
    
    // Calculate unified side-by-side view
    const sideBySide = generateSideBySideDiff(fromContent, toContent);
    
    return c.json({
      projectId,
      filePath,
      from: fromBranch,
      to: toBranch,
      fromContent,
      toContent,
      sideBySide,
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get diff' 
    }, 500);
  }
});

/**
 * Preview changes in a worktree vs main
 * GET /api/diff/worktree/:projectId?taskId=xxx
 */
app.get('/worktree/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const taskId = c.req.query('taskId');
  const workspacesPath = getWorkspacesPath();
  
  if (!taskId) {
    return c.json({ error: 'taskId query parameter is required' }, 400);
  }
  
  // Get the worktree path for this task
  const clean = taskId.replace(/-/g, '').slice(0, 8);
  const branchName = `task/${clean}`;
  
  // Find worktree for this task
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Get status of the worktree
    const { stdout: status } = await exec(
      'git status --porcelain',
      projectPath
    );
    
    // Check for this specific branch
    const worktrees = await exec(
      `git worktree list --porcelain | grep -A 1 \"${branchName}\"`,
      projectPath
    ).catch(() => ({ stdout: '' }));
    
    // Get unstaged changes
    const { stdout: diff } = await exec(
      'git diff',
      projectPath
    );
    
    // Get staged changes
    const { stdout: staged } = await exec(
      'git diff --cached',
      projectPath
    );
    
    return c.json({
      projectId,
      taskId,
      branchName,
      hasUnstaged: diff.trim().length > 0,
      hasStaged: staged.trim().length > 0,
      unstagedFiles: diff.split('\n').filter(l => l.trim()),
      stagedFiles: staged.split('\n').filter(l => l.trim()),
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to get worktree diff' 
    }, 500);
  }
});

// ============================================
// Helper Functions
// ============================================

function parseDiffOutput(diff: string, filePath: string): {
  additions: number;
  deletions: number;
  hunks: Array<{
    header: string;
    lines: string[];
  }>;
  raw: string;
} {
  const lines = diff.split('\n');
  
  let additions = 0;
  let deletions = 0;
  const hunks: Array<{ header: string; lines: string[] }> = [];
  let currentHunk: { header: string; lines: string[] } | null = null;
  
  for (const line of lines) {
    // Count additions/deletions
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    
    // Parse hunk headers
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: line, lines: [] };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }
  
  if (currentHunk) hunks.push(currentHunk);
  
  return {
    additions,
    deletions,
    hunks,
    raw: diff,
  };
}

function parseStatsLine(stats: string): { files: number; additions: number; deletions: number } {
  const filesMatch = stats.match(/(\d+) file/);
  const addMatch = stats.match(/(\d+) insertion/i);
  const delMatch = stats.match(/(\d+) deletion/i);
  
  return {
    files: filesMatch ? parseInt(filesMatch[1]) : 0,
    additions: addMatch ? parseInt(addMatch[1]) : 0,
    deletions: delMatch ? parseInt(delMatch[1]) : 0,
  };
}

async function getFileAtRef(
  projectPath: string,
  ref: string,
  filePath: string
): Promise<string> {
  try {
    const { stdout } = await exec(
      `git show ${ref}:${filePath}`,
      projectPath
    );
    return stdout;
  } catch {
    // File doesn't exist in this ref
    return '';
  }
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'header';
  leftLineNum?: number;
  rightLineNum?: number;
  content: string;
}

function generateSideBySideDiff(
  leftContent: string,
  rightContent: string
): {
  leftLines: DiffLine[];
  rightLines: DiffLine[];
  stats: { added: number; removed: number; unchanged: number };
} {
  const leftLines = leftContent.split('\n');
  const rightLines = rightContent.split('\n');
  
  // Simple line-by-line diff (simplified LCS approach)
  const result: {
    leftLines: DiffLine[];
    rightLines: DiffLine[];
    stats: { added: number; removed: number; unchanged: number };
  } = {
    leftLines: [],
    rightLines: [],
    stats: { added: 0, removed: 0, unchanged: 0 },
  };
  
  // Use simple approach: compare line by line
  const maxLines = Math.max(leftLines.length, rightLines.length);
  
  let leftNum = 1;
  let rightNum = 1;
  
  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i];
    const rightLine = rightLines[i];
    
    if (leftLine === rightLine) {
      result.leftLines.push({
        type: 'unchanged',
        leftLineNum: leftNum++,
        rightLineNum: rightNum,
        content: leftLine || '',
      });
      result.rightLines.push({
        type: 'unchanged',
        leftLineNum: leftNum - 1,
        rightLineNum: rightNum++,
        content: leftLine || '',
      });
      result.stats.unchanged++;
    } else {
      if (leftLine !== undefined && !rightLines.includes(leftLine)) {
        result.leftLines.push({
          type: 'removed',
          leftLineNum: leftNum++,
          content: leftLine,
        });
        result.rightLines.push({
          type: 'removed',
          content: '',
        });
        result.stats.removed++;
      }
      
      if (rightLine !== undefined && !leftLines.includes(rightLine)) {
        result.leftLines.push({
          type: 'added',
          content: '',
        });
        result.rightLines.push({
          type: 'added',
          rightLineNum: rightNum++,
          content: rightLine,
        });
        result.stats.added++;
      }
    }
  }
  
  return result;
}

export default app;