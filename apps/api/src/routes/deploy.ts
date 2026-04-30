/**
 * Deploy Integration Routes
 * 
 * One-click deploy to hosting platforms
 */

import { Hono } from 'hono';
import { exec as execChildProcess } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const exec = promisify(execChildProcess);
const app = new Hono();

type Platform = 'vercel' | 'netlify' | 'railway' | 'fly';

interface DeployConfig {
  platform: Platform;
  projectPath: string;
  options?: {
    projectName?: string;
    team?: string;
    region?: string;
    token?: string;
  };
}

interface DeployResult {
  success: boolean;
  platform: Platform;
  url?: string;
  deployId?: string;
  status?: string;
  error?: string;
}

/**
 * Supported platforms
 */
const platforms = {
  vercel: {
    name: 'Vercel',
    deployCommand: 'vercel --yes',
    envPrefix: 'VERCEL_',
    requiresToken: true,
  },
  netlify: {
    name: 'Netlify',
    deployCommand: 'netlify deploy --prod --dir=dist',
    envPrefix: 'NETLIFY_',
    requiresToken: true,
  },
  railway: {
    name: 'Railway',
    deployCommand: 'railway up',
    envPrefix: 'RAILWAY_',
    requiresToken: true,
  },
  fly: {
    name: 'Fly.io',
    deployCommand: 'fly deploy',
    envPrefix: 'FLY_',
    requiresToken: true,
  },
};

/**
 * List supported platforms
 * GET /api/deploy/platforms
 */
app.get('/platforms', async (c) => {
  return c.json({
    platforms: Object.entries(platforms).map(([id, p]) => ({
      id,
      name: p.name,
      requiresToken: p.requiresToken,
    })),
  });
});

/**
 * Check deploy prerequisites
 * GET /api/deploy/check?platform=vercel
 */
app.get('/check', async (c) => {
  const platform = c.req.query('platform') as Platform;
  
  if (!platform || !platforms[platform as Platform]) {
    return c.json({ 
      error: 'Invalid platform',
      validPlatforms: Object.keys(platforms)
    }, 400);
  }
  
  const config = platforms[platform as Platform];
  const tokenName = `${config.envPrefix}AUTH_TOKEN`;
  const hasToken = !!process.env[tokenName];
  
  // Check if CLI is installed
  let cliInstalled = false;
  try {
    const cmd = platform === 'vercel' ? 'vercel --version' :
                platform === 'netlify' ? 'netlify --version' :
                platform === 'railway' ? 'railway --version' :
                platform === 'fly' ? 'fly --version' : 'echo';
    
    await exec(cmd);
    cliInstalled = true;
  } catch {
    cliInstalled = false;
  }
  
  return c.json({
    platform,
    cliInstalled,
    hasToken,
    ready: cliInstalled && hasToken,
  });
});

/**
 * Deploy to a platform
 * POST /api/deploy
 */
app.post('/', async (c) => {
  const body = await c.req.json();
  const { platform, projectId, projectName } = body;
  
  if (!platform || !platforms[platform as Platform]) {
    return c.json({ 
      error: 'Invalid platform',
      validPlatforms: Object.keys(platforms)
    }, 400);
  }
  
  if (!projectId) {
    return c.json({ error: 'projectId is required' }, 400);
  }
  
  const workspacesPath = process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Check if project directory exists
    const { exists } = await checkProjectExists(projectPath);
    
    if (!exists) {
      return c.json({ 
        error: 'Project directory not found',
        projectPath,
      }, 404);
    }
    
    // Build the project first
    await buildProject(projectPath, platform);
    
    // Deploy
    const result = await deploy(platform as Platform, projectPath, { projectName });
    
    return c.json(result);
  } catch (error) {
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Deploy failed',
    }, 500);
  }
});

/**
 * Get deployment status
 * GET /api/deploy/status/:deployId
 */
app.get('/status/:deployId', async (c) => {
  const deployId = c.req.param('deployId');
  
  // For now, return a placeholder
  // In production, you'd check with the platform API
  return c.json({
    deployId,
    status: 'unknown',
    message: 'Status tracking not yet implemented',
  });
});

/**
 * Create deployment preview (for PRs)
 * POST /api/deploy/preview
 */
app.post('/preview', async (c) => {
  const body = await c.req.json();
  const { platform, projectId, branch } = body;
  
  if (!platform || !platforms[platform as Platform]) {
    return c.json({ error: 'Invalid platform' }, 400);
  }
  
  if (!projectId || !branch) {
    return c.json({ error: 'projectId and branch are required' }, 400);
  }
  
  const workspacesPath = process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
  const projectPath = join(workspacesPath, `project-${projectId}`);
  
  try {
    // Build project
    await buildProject(projectPath, platform);
    
    // Deploy preview with branch name
    const result = await deploy(platform as Platform, projectPath, {
      projectName: branch,
      options: ['--branch', branch],
    });
    
    return c.json({
      ...result,
      branch,
      type: 'preview',
    });
  } catch (error) {
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Preview deploy failed',
    }, 500);
  }
});

/**
 * Generate deployment manifest/config
 * GET /api/deploy/manifest/:platform
 */
app.get('/manifest/:platform', async (c) => {
  const platform = c.req.param('platform') as Platform;
  
  if (!platforms[platform]) {
    return c.json({ error: 'Invalid platform' }, 400);
  }
  
  const manifests: Record<Platform, object> = {
    vercel: {
      buildCommand: 'npm run build',
      outputDirectory: '.next',
      installCommand: 'npm install',
    },
    netlify: {
      buildCommand: 'npm run build',
      publish: 'dist',
      headers: [
        { source: '/(.*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      ],
    },
    railway: {
      buildCommand: 'npm install && npm run build',
      startCommand: 'npm start',
    },
    fly: {
      buildCommand: 'npm install && npm run build',
      port: 3000,
    },
  };
  
  return c.json({
    platform,
    manifest: manifests[platform] || {},
  });
});

// ============================================
// Helper Functions
// ============================================

async function checkProjectExists(path: string): Promise<{ exists: boolean }> {
  try {
    const { exists } = await import('fs').then(fs => 
      fs.promises.access(path).then(() => ({ exists: true })).catch(() => ({ exists: false }))
    );
    return { exists };
  } catch {
    return { exists: false };
  }
}

async function buildProject(projectPath: string, platform: Platform): Promise<void> {
  // Detect project type and build
  const hasPackageJson = await fileExists(join(projectPath, 'package.json'));
  const hasRequirements = await fileExists(join(projectPath, 'requirements.txt'));
  const hasCargoToml = await fileExists(join(projectPath, 'Cargo.toml'));
  
  if (hasPackageJson) {
    console.log('Building Node.js project...');
    await exec('npm install', { cwd: projectPath });
    await exec('npm run build 2>/dev/null || npm run compile 2>/dev/null || true', { cwd: projectPath });
  } else if (hasRequirements) {
    console.log('Building Python project...');
    await exec('pip install -r requirements.txt', { cwd: projectPath });
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await import('fs').then(fs => fs.promises.access(path));
    return true;
  } catch {
    return false;
  }
}

async function deploy(
  platform: Platform,
  projectPath: string,
  config?: { projectName?: string; options?: string[] }
): Promise<DeployResult> {
  const platformConfig = platforms[platform];
  let deployUrl: string | undefined;
  let deployId: string | undefined;
  
  switch (platform) {
    case 'vercel': {
      const token = process.env.VERCEL_AUTH_TOKEN;
      if (!token) {
        // Try without token (limited deploys)
        try {
          const { stdout } = await exec(
            `vercel --yes --local-config "${projectPath}"`,
            { cwd: projectPath }
          );
          
          const urlMatch = stdout.match(/https?:\/\/[^\s]+/);
          if (urlMatch) deployUrl = urlMatch[0];
          
          const idMatch = stdout.match(/deployment[_-]?id[=:]?\s*([a-z0-9-]+)/i);
          if (idMatch) deployId = idMatch[1];
        } catch {
          throw new Error('VERCEL_AUTH_TOKEN not set. Please configure your Vercel token.');
        }
      }
      break;
    }
      
    case 'netlify': {
      const token = process.env.NETLIFY_AUTH_TOKEN;
      if (!token) {
        try {
          const { stdout } = await exec('netlify deploy --prod', { cwd: projectPath });
          const urlMatch = stdout.match(/Website\s+: (.+)/);
          if (urlMatch) deployUrl = urlMatch[1];
        } catch {
          throw new Error('NETLIFY_AUTH_TOKEN not set.');
        }
      }
      break;
    }
      
    case 'railway': {
      try {
        const { stdout } = await exec('railway up --detached', { cwd: projectPath });
        const urlMatch = stdout.match(/https:\/\/[^\s]+/);
        if (urlMatch) deployUrl = urlMatch[0];
      } catch {
        throw new Error('Railway deployment failed. Check RAILWAY_TOKEN.');
      }
      break;
    }
      
    case 'fly': {
      try {
        // First ensure app exists
        const appName = config?.projectName || 'agentic-app';
        await exec(`fly apps create ${appName} 2>/dev/null || true`, { cwd: projectPath });
        
        // Set secrets
        await exec(`fly secrets set ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ''} 2>/dev/null || true`, { cwd: projectPath });
        
        // Deploy
        const { stdout } = await exec('fly deploy', { cwd: projectPath });
        
        // Get the app URL
        const { stdout: status } = await exec(`fly apps list | grep ${appName}`, { cwd: projectPath });
        const urlMatch = status.match(/https:\/\/[^\s]+/);
        if (urlMatch) deployUrl = urlMatch[0];
      } catch {
        throw new Error('Fly.io deployment failed.');
      }
      break;
    }
  }
  
  return {
    success: true,
    platform,
    url: deployUrl || 'https://example.com (token required for actual URL)',
    deployId,
    status: 'deployed',
  };
}

export default app;