import { Hono } from 'hono';

const events = new Hono();

events.get('/stream', async (c) => {
  const { sse } = c.var;

  const stream = new ReadableStream({
    start(controller) {
      const clientId = sse.addClient(controller);
      sse.sendToClient(clientId, 'connected', { clientId });

      c.req.raw.signal?.addEventListener('abort', () => {
        sse.removeClient(clientId);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
});

export default events;
