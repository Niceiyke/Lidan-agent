/**
 * Agentic OS - Streaming Service
 * 
 * Provides real-time token streaming via SSE for AI agent output
 */

import { EventEmitter } from 'events';
import { SSEBroadcaster } from './sse.js';

export interface TokenEvent {
  agentId: string;
  agentRole: string;
  projectId: string;
  taskId?: string;
  token: string;
  type: 'text' | 'thinking' | 'tool';
  timestamp: string;
}

export interface StreamSession {
  id: string;
  projectId: string;
  taskId?: string;
  createdAt: Date;
}

export class StreamingService extends EventEmitter {
  private sessions: Map<string, StreamSession> = new Map();
  private sse: SSEBroadcaster;
  
  constructor(sse: SSEBroadcaster) {
    super();
    this.sse = sse;
  }

  /**
   * Create a new streaming session
   */
  createSession(projectId: string, taskId?: string): string {
    const sessionId = crypto.randomUUID();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      projectId,
      taskId,
      createdAt: new Date(),
    });
    
    return sessionId;
  }

  /**
   * Get a streaming session
   */
  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Stream a token event to all subscribers
   */
  streamToken(
    projectId: string,
    agentId: string,
    agentRole: string,
    token: string,
    type: 'text' | 'thinking' | 'tool' = 'text',
    taskId?: string
  ): void {
    const event: TokenEvent = {
      agentId,
      agentRole,
      projectId,
      taskId,
      token,
      type,
      timestamp: new Date().toISOString(),
    };

    // Emit locally
    this.emit('token', event);

    // Broadcast via SSE
    this.sse.broadcast('token', {
      event: 'token',
      data: event,
    });

    // Also broadcast to project-specific channel
    this.sse.broadcast(`project:${projectId}:token`, {
      event: 'token',
      data: event,
    });
  }

  /**
   * Stream thinking event (internal reasoning)
   */
  streamThinking(
    projectId: string,
    agentId: string,
    agentRole: string,
    thought: string,
    taskId?: string
  ): void {
    this.streamToken(projectId, agentId, agentRole, thought, 'thinking', taskId);
  }

  /**
   * Stream tool execution event
   */
  streamToolStart(
    projectId: string,
    agentId: string,
    agentRole: string,
    toolName: string,
    args: any,
    taskId?: string
  ): void {
    const event = {
      event: 'tool_start',
      data: {
        agentId,
        agentRole,
        projectId,
        taskId,
        tool: toolName,
        args,
        timestamp: new Date().toISOString(),
      },
    };
    
    this.emit('tool_start', event.data);
    this.sse.broadcast('tool_start', event);
    this.sse.broadcast(`project:${projectId}:tool`, event);
  }

  /**
   * Stream tool completion event
   */
  streamToolEnd(
    projectId: string,
    agentId: string,
    agentRole: string,
    toolName: string,
    result: any,
    duration: number,
    taskId?: string
  ): void {
    const event = {
      event: 'tool_end',
      data: {
        agentId,
        agentRole,
        projectId,
        taskId,
        tool: toolName,
        result: typeof result === 'string' ? result.slice(0, 500) : result,
        duration,
        timestamp: new Date().toISOString(),
      },
    };
    
    this.emit('tool_end', event.data);
    this.sse.broadcast('tool_end', event);
    this.sse.broadcast(`project:${projectId}:tool`, event);
  }

  /**
   * Stream task status update
   */
  streamTaskUpdate(
    projectId: string,
    taskId: string,
    status: 'running' | 'done' | 'failed' | 'blocked',
    message?: string
  ): void {
    const event = {
      event: 'task_update',
      data: {
        projectId,
        taskId,
        status,
        message,
        timestamp: new Date().toISOString(),
      },
    };
    
    this.sse.broadcast('task_update', event);
    this.sse.broadcast(`project:${projectId}:task`, event);
  }

  /**
   * Stream agent status update
   */
  streamAgentStatus(
    projectId: string,
    agentId: string,
    agentRole: string,
    status: string,
    taskId?: string
  ): void {
    const event = {
      event: 'agent_status',
      data: {
        projectId,
        agentId,
        agentRole,
        status,
        taskId,
        timestamp: new Date().toISOString(),
      },
    };
    
    this.sse.broadcast('agent_status', event);
    this.sse.broadcast(`project:${projectId}:agent`, event);
  }

  /**
   * Cleanup a session
   */
  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active sessions for a project
   */
  getProjectSessions(projectId: string): StreamSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.projectId === projectId);
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    activeSessions: number;
    totalTokens: number;
  } {
    return {
      activeSessions: this.sessions.size,
      totalTokens: 0, // Could track this with a counter
    };
  }
}

// Singleton instance
let streamingService: StreamingService | null = null;

export function getStreamingService(sse?: SSEBroadcaster): StreamingService {
  if (!streamingService && sse) {
    streamingService = new StreamingService(sse);
  }
  if (!streamingService) {
    throw new Error('StreamingService not initialized. Pass SSE broadcaster.');
  }
  return streamingService;
}

export function initializeStreamingService(sse: SSEBroadcaster): StreamingService {
  streamingService = new StreamingService(sse);
  return streamingService;
}