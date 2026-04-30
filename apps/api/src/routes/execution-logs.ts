/**
 * Execution Logs Routes
 * 
 * Stream container execution logs via SSE
 */

import { Hono } from 'hono';
import { ContainerManager } from '../sandbox/container-manager.js';

const app = new Hono();

// Lazy-initialized container manager
let _containerManager: ContainerManager | null = null;

function getContainerManager(prisma: any): ContainerManager {
  if (!_containerManager) {
    _containerManager = new ContainerManager(prisma);
  }
  return _containerManager;
}

/**
 * Get execution logs (non-streaming)
 * GET /api/executions/:id/logs
 */
app.get('/:id/logs', async (c) => {
  const executionId = c.req.param('id');
  const prisma = c.get('prisma');
  const containerManager = getContainerManager(prisma);
  
  // Get execution from database
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });
  
  if (!execution) {
    return c.json({ error: 'Execution not found' }, 404);
  }
  
  const containerName = execution.containerName;
  
  if (!containerName) {
    return c.json({ error: 'No container associated with this execution' }, 400);
  }
  
  const tail = parseInt(c.req.query('tail') || '100', 10);
  const logs = await containerManager.getLogs(containerName, tail);
  
  return c.json({
    executionId,
    containerName,
    logs: logs.split('\n').filter(Boolean),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Stream execution logs via SSE
 * GET /api/executions/:id/logs/stream
 */
app.get('/:id/logs/stream', async (c) => {
  const executionId = c.req.param('id');
  const prisma = c.get('prisma');
  const containerManager = getContainerManager(prisma);
  
  // Get execution from database
  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
  });
  
  if (!execution) {
    return c.json({ error: 'Execution not found' }, 404);
  }
  
  const containerName = execution.containerName;
  
  if (!containerName) {
    return c.json({ error: 'No container associated with this execution' }, 400);
  }
  
  const tail = parseInt(c.req.query('tail') || '50', 10);
  
  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encode = (event: string, data: any) => {
        return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      };
      
      // Send initial info
      controller.enqueue(new TextEncoder().encode(
        encode('init', { executionId, containerName, tail })
      ));
      
      // Stream logs
      try {
        let lineCount = 0;
        const maxLines = 1000;
        
        await containerManager.streamLogsCallback(
          containerName,
          (line) => {
            if (lineCount < maxLines) {
              controller.enqueue(new TextEncoder().encode(
                encode('log', { line, timestamp: new Date().toISOString() })
              ));
              lineCount++;
            }
          },
          { tail, timeout: 60000 }
        );
        
        controller.enqueue(new TextEncoder().encode(
          encode('complete', { totalLines: lineCount })
        ));
      } catch (error) {
        controller.enqueue(new TextEncoder().encode(
          encode('error', { 
            message: error instanceof Error ? error.message : 'Stream failed' 
          })
        ));
      }
      
      controller.close();
    },
  });
  
  return c.body(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

/**
 * Stream logs for a project (all containers)
 * GET /api/executions/project/:projectId/logs/stream
 */
app.get('/project/:projectId/logs/stream', async (c) => {
  const projectId = c.req.param('projectId');
  const containerId = c.req.query('container');
  const prisma = c.get('prisma');
  const containerManager = getContainerManager(prisma);
  
  // Find container by projectId
  let containerName: string;
  
  if (containerId) {
    containerName = containerId;
  } else {
    // Get the project's container from database
    const container = await prisma.container.findFirst({
      where: { projectId, status: 'running' },
    });
    
    if (!container) {
      return c.json({ error: 'No running container for this project' }, 404);
    }
    
    containerName = container.name;
  }
  
  const tail = parseInt(c.req.query('tail') || '50', 10);
  
  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encode = (event: string, data: any) => {
        return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      };
      
      controller.enqueue(new TextEncoder().encode(
        encode('init', { projectId, containerName, tail })
      ));
      
      containerManager.streamLogsCallback(
        containerName,
        (line) => {
          controller.enqueue(new TextEncoder().encode(
            encode('log', { line, timestamp: new Date().toISOString() })
          ));
        },
        { tail, timeout: 60000 }
      )
        .then(() => {
          controller.enqueue(new TextEncoder().encode(encode('complete', {})));
          controller.close();
        })
        .catch((error) => {
          controller.enqueue(new TextEncoder().encode(
            encode('error', { message: error.message })
          ));
          controller.close();
        });
    },
  });
  
  return c.body(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});

export default app;