/**
 * Streaming Routes
 * 
 * SSE endpoints for real-time token streaming
 */

import { Hono } from 'hono';
import { getStreamingService } from '../streaming.js';

const app = new Hono();

/**
 * Stream tokens for a project
 * GET /api/streaming/:projectId
 */
app.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  const streamingService = getStreamingService();
  
  // Create a session for this stream
  const sessionId = streamingService.createSession(projectId);
  
  // Return SSE response
  return c.body(
    new ReadableStream({
      start(controller) {
        // Send session info
        const initEvent = `event: session\ndata: ${JSON.stringify({ sessionId, projectId })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initEvent));
        
        // Store cleanup function
        (c as any).cleanup = () => {
          streamingService.cleanupSession(sessionId);
        };
      },
      cancel() {
        const cleanup = (c as any).cleanup;
        if (cleanup) cleanup();
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    }
  );
});

/**
 * Stream tokens for a specific task
 * GET /api/streaming/project/:projectId/task/:taskId
 */
app.get('/project/:projectId/task/:taskId', async (c) => {
  const projectId = c.req.param('projectId');
  const taskId = c.req.param('taskId');
  const streamingService = getStreamingService();
  
  const sessionId = streamingService.createSession(projectId, taskId);
  
  return c.body(
    new ReadableStream({
      start(controller) {
        const initEvent = `event: session\ndata: ${JSON.stringify({ sessionId, projectId, taskId })}\n\n`;
        controller.enqueue(new TextEncoder().encode(initEvent));
        
        (c as any).cleanup = () => {
          streamingService.cleanupSession(sessionId);
        };
      },
      cancel() {
        const cleanup = (c as any).cleanup;
        if (cleanup) cleanup();
      }
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    }
  );
});

/**
 * Stream logs for an execution
 * GET /api/streaming/execution/:executionId
 */
app.get('/execution/:executionId', async (c) => {
  const executionId = c.req.param('executionId');
  // Implementation in container-manager.ts
  // This would stream container logs
  
  return c.json({ 
    error: 'Execution log streaming not implemented',
    executionId 
  }, 501);
});

/**
 * Get streaming stats
 * GET /api/streaming/stats
 */
app.get('/stats', async (c) => {
  const streamingService = getStreamingService();
  return c.json(streamingService.getStats());
});

export default app;