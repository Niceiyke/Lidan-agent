import { v4 as uuid } from 'uuid';

export type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

export class SSEBroadcaster {
  private clients = new Map<string, SSEClient>();

  addClient(controller: ReadableStreamDefaultController): string {
    const id = uuid();
    this.clients.set(id, { id, controller });
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  broadcast(event: string, data: unknown): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(message);

    for (const client of this.clients.values()) {
      try {
        client.controller.enqueue(encoded);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  sendToClient(clientId: string, event: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoder = new TextEncoder();
    try {
      client.controller.enqueue(encoder.encode(message));
    } catch {
      this.clients.delete(clientId);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}
