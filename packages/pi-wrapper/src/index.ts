import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { AgentEvent, AgentStatus } from '@agentic-os/types';

export interface PiConfig {
  id: string;
  name: string;
  role: 'planner' | 'coder' | 'reviewer' | 'tester' | 'debugger';
  model?: string;
  systemPrompt?: string;
  workingDirectory?: string;
}

export interface PiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class PiAgent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly role: string;
  public status: AgentStatus = 'idle';
  private process?: ChildProcess;
  private ready = false;
  private pendingRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private model: string;
  private systemPrompt?: string;
  private workingDirectory?: string;

  constructor(config: PiConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.systemPrompt = config.systemPrompt;
    this.workingDirectory = config.workingDirectory;
  }

  async start(): Promise<void> {
    if (this.process) return;

    return new Promise((resolve, reject) => {
      this.process = spawn('pi', ['rpc', '--model', this.model], {
        cwd: this.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      this.process.stdout?.on('data', (data) => this.handleStdout(data.toString()));
      this.process.stderr?.on('data', (data) => this.emit('log', { level: 'error', message: data.toString() }));

      this.process.on('error', (err) => {
        this.status = 'failed';
        this.emit('error', err);
        reject(err);
      });

      this.process.on('exit', (code) => {
        this.ready = false;
        if (code !== 0) {
          this.status = 'failed';
          this.emit('status_change', { status: 'failed', reason: `Process exited with code ${code}` });
        }
      });

      const timeout = setTimeout(() => reject(new Error('Pi startup timeout')), 10000);
      this.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private handleStdout(data: string): void {
    const lines = data.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        this.handleMessage(msg);
      } catch {
        this.emit('log', { message: line });
      }
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'ready':
        this.ready = true;
        if (this.systemPrompt) {
          this.send({ type: 'system_prompt', prompt: this.systemPrompt });
        }
        this.emit('ready');
        break;
      case 'response':
        if (msg.requestId && this.pendingRequests.has(msg.requestId as string)) {
          const { resolve } = this.pendingRequests.get(msg.requestId as string)!;
          this.pendingRequests.delete(msg.requestId as string);
          resolve(msg.result);
        }
        break;
      case 'error':
        this.emit('error', new Error(msg.message as string));
        break;
      case 'tool_call':
        this.emit('tool_call', msg);
        break;
      default:
        this.emit('message', msg);
    }
  }

  private send(message: Record<string, unknown>): void {
    if (!this.process?.stdin) return;
    this.process.stdin.write(JSON.stringify(message) + '\n');
  }

  async execute(prompt: string, requestId?: string): Promise<unknown> {
    if (!this.ready || !this.process) {
      throw new Error('Agent not ready');
    }

    const id = requestId || crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.send({ type: 'execute', id, prompt });
    });
  }

  async useTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.ready || !this.process) {
      throw new Error('Agent not ready');
    }

    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject });
      this.send({ type: 'tool_call', id: requestId, tool: toolName, args });
    });
  }

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    if (this.ready) {
      this.send({ type: 'system_prompt', prompt });
    }
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.process.kill();
    this.process = undefined;
    this.ready = false;
    this.status = 'idle';
  }

  isReady(): boolean {
    return this.ready;
  }
}
