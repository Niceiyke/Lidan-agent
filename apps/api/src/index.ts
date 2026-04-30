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

const prisma = new PrismaClient();
const sse = new SSEBroadcaster();
const workspacesPath = process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';

// Create orchestrator instance
const orchestrator = new Orchestrator({
  workspacesPath,
  prisma,
  sse,
});

// Initialize flag
let initialized = false;

async function main() {
  if (initialized) return;
  initialized = true;
  
  console.log('Initializing Agentic OS...');
  
  // Start workers
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

  // Health check with worker status
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

  // Queue management endpoints
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
  console.log(`Agentic OS API running on port ${port}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down...`);
    
    try {
      await stopWorkers();
      await orchestrator.shutdown();
      await prisma.$disconnect();
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  serve({ fetch: app.fetch, port });
}

main().catch(console.error);
export { prisma, sse, orchestrator };
