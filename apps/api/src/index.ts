import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { PrismaClient } from '@prisma/client';
import tasksRouter from './routes/tasks.js';
import agentsRouter from './routes/agents.js';
import plansRouter from './routes/plans.js';
import eventsRouter from './routes/events.js';
import approvalsRouter from './routes/approvals.js';
import goalsRouter from './routes/goals.js';
import projectsRouter from './routes/projects.js';
import executionsRouter from './routes/executions.js';
import filesRouter from './routes/files.js';
import { SSEBroadcaster } from './sse.js';
import { startWorkers, stopWorkers, getWorkerStatus } from './worker.js';
import { getQueueStats, pauseQueues, resumeQueues } from './queue.js';
import { Orchestrator, OrchestratorConfig } from './orchestrator.js';
import { 
  waitForDependencies, 
  cleanupStaleWorktrees,
  getComprehensiveHealth,
  checkDatabaseHealth,
  checkRedisHealth,
  checkDockerHealth,
  sleep 
} from './resilience.js';

const prisma = new PrismaClient();
const sse = new SSEBroadcaster();
const workspacesPath = process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Graceful shutdown flag
let isShuttingDown = false;
let server: any = null;

async function main() {
  console.log('🚀 Starting Agentic OS...');
  
  // Clean up stale worktrees on startup
  console.log('🧹 Cleaning up stale worktrees...');
  const cleanup = await cleanupStaleWorktrees(workspacesPath, 48); // 48 hours
  if (cleanup.total > 0) {
    console.log(`   Found ${cleanup.total} worktrees, cleaned ${cleanup.cleaned} stale ones`);
  }
  
  // Wait for dependencies
  console.log('⏳ Waiting for dependencies...');
  const ready = await waitForDependencies(prisma, redisUrl, 30000);
  if (!ready) {
    console.error('❌ Failed to connect to dependencies. Exiting...');
    process.exit(1);
  }
  
  // Create orchestrator instance
  const orchestrator = new Orchestrator({
    workspacesPath,
    prisma,
    sse,
  });
  
  console.log('👷 Starting workers...');
  await startWorkers(sse, prisma);
  
  const app = new Hono();

  app.use(logger());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }));

  // Middleware to inject shared dependencies
  app.use(async (c, next) => {
    c.set('prisma', prisma);
    c.set('sse', sse);
    (c as any).orchestrator = orchestrator;
    await next();
  });

  // Basic health check
  app.get('/health', async (c) => {
    const workerStatus = await getWorkerStatus().catch(() => null);
    const queueStats = await getQueueStats('agent-tasks').catch(() => null);
    
    return c.json({ 
      status: 'ok', 
      version: '0.2.0',
      timestamp: new Date().toISOString(),
      workers: workerStatus,
      queue: queueStats,
    });
  });

  // Detailed health check with dependency status
  app.get('/health/detailed', async (c) => {
    const health = await getComprehensiveHealth(prisma, redisUrl, workspacesPath);
    const workerStatus = await getWorkerStatus().catch(() => null);
    const queueStats = await getQueueStats('agent-tasks').catch(() => null);
    
    const status = health.healthy ? 200 : 503;
    
    return c.json({ 
      status: health.healthy ? 'healthy' : 'degraded',
      version: '0.2.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: health.database,
        redis: health.redis,
        docker: health.docker,
        worktrees: health.worktrees,
      },
      workers: workerStatus,
      queue: queueStats,
    }, status);
  });

  // Readiness probe (for k8s)
  app.get('/ready', async (c) => {
    const dbHealth = await checkDatabaseHealth(prisma, { maxRetries: 1 });
    const redisHealth = await checkRedisHealth(redisUrl, { maxRetries: 1 });
    
    if (dbHealth?.connected && redisHealth?.connected) {
      return c.json({ ready: true });
    }
    
    return c.json({ 
      ready: false,
      database: dbHealth?.connected ?? false,
      redis: redisHealth?.connected ?? false,
    }, 503);
  });

  // Liveness probe (for k8s)
  app.get('/live', async (c) => {
    return c.json({ alive: true });
  });

  // API routes
  app.route('/api/tasks', tasksRouter);
  app.route('/api/agents', agentsRouter);
  app.route('/api/plans', plansRouter);
  app.route('/api/events', eventsRouter);
  app.route('/api/approvals', approvalsRouter);
  app.route('/api/goals', goalsRouter);
  app.route('/api/projects', projectsRouter);
  app.route('/api/executions', executionsRouter);
  app.route('/api/files', filesRouter);

  // Admin routes
  app.post('/api/admin/queue/pause', async (c) => {
    await pauseQueues();
    return c.json({ success: true, message: 'Queue paused' });
  });

  app.post('/api/admin/queue/resume', async (c) => {
    await resumeQueues();
    return c.json({ success: true, message: 'Queue resumed' });
  });

  app.get('/api/admin/queue/stats', async (c) => {
    const taskStats = await getQueueStats('agent-tasks');
    const execStats = await getQueueStats('executions');
    return c.json({ tasks: taskStats, executions: execStats });
  });

  // Worktree cleanup endpoint
  app.post('/api/admin/cleanup', async (c) => {
    const maxAgeHours = parseInt(c.req.query('hours') || '48', 10);
    const result = await cleanupStaleWorktrees(workspacesPath, maxAgeHours);
    return c.json({
      success: true,
      total: result.total,
      cleaned: result.cleaned,
    });
  });

  // SSE events endpoint
  app.get('/events/stream', async (c) => {
    const clientId = crypto.randomUUID();
    sse.addClient(clientId, c);

    return c.body(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });

  const port = parseInt(process.env.PORT || '3001', 10);
  
  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('Already shutting down...');
      return;
    }
    
    isShuttingDown = true;
    console.log(`\n${signal} received, initiating graceful shutdown...`);
    
    try {
      // Stop accepting new connections
      if (server) {
        server.close();
      }
      
      // Pause queue to stop accepting new jobs
      console.log('Pausing queue...');
      await pauseQueues();
      
      // Give time for current jobs to complete
      console.log('Waiting for current jobs to complete...');
      await sleep(5000);
      
      // Stop workers
      console.log('Stopping workers...');
      await stopWorkers();
      
      // Cleanup orchestrator
      console.log('Cleaning up...');
      await orchestrator.shutdown?.();
      
      // Disconnect from database
      console.log('Disconnecting from database...');
      await prisma.$disconnect();
      
      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  console.log(`\n✅ Agentic OS API running on port ${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Detailed: http://localhost:${port}/health/detailed`);
  console.log(`   Ready: http://localhost:${port}/ready`);
  
  server = serve({ fetch: app.fetch, port });
}

main().catch(console.error);
export { prisma, sse };
