import { EventEmitter } from 'events';
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createReadToolDefinition,
  createWriteToolDefinition,
  createEditToolDefinition,
  createBashToolDefinition,
} from '@mariozechner/pi-coding-agent';
import type { AgentSession, AgentSessionEvent } from '@mariozechner/pi-coding-agent';
import type {
  AgentRole,
  AgentStatus,
  Task,
  TaskResult,
  AgentTokenEvent,
  AgentThinkingEvent,
  ToolStartEvent,
  ToolEndEvent,
  AgentCompleteEvent,
} from '@agentic-os/types';
import { ContainerManager } from '../sandbox/container-manager.js';
import { WorktreeManager } from '../git/worktree-manager.js';

// ============================================
// Agent Configuration
// ============================================

export interface AgentConfig {
  id: string;
  projectId: string;
  name: string;
  role: AgentRole;
  workspacePath: string;
  worktreePath?: string;
  branchName?: string;
  containerId?: string;
  modelProvider?: string;
  modelId?: string;
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  systemPrompt?: string;
}

// ============================================
// Base Agent Class
// ============================================

export abstract class BaseAgent extends EventEmitter {
  protected session: AgentSession | null = null;
  protected config: AgentConfig;
  protected status: AgentStatus = 'idle';
  protected authStorage: AuthStorage;
  protected modelRegistry: ModelRegistry;
  protected containerManager: ContainerManager | null = null;
  protected worktreeManager: WorktreeManager | null = null;
  protected ready = false;

  constructor(config: AgentConfig) {
    super();
    this.config = config;
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage);
  }

  /**
   * Initialize the agent session
   */
  async initialize(
    containerManager?: ContainerManager,
    worktreeManager?: WorktreeManager
  ): Promise<void> {
    if (this.session) return;

    this.containerManager = containerManager ?? null;
    this.worktreeManager = worktreeManager ?? null;

    const tools = this.getTools();
    const sessionManager = SessionManager.inMemory(this.config.workspacePath);
    const settingsManager = SettingsManager.inMemory();

    const { session } = await createAgentSession({
      cwd: this.config.workspacePath,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      sessionManager,
      settingsManager,
      tools,
      model: this.config.modelProvider && this.config.modelId
        ? { provider: this.config.modelProvider, id: this.config.modelId }
        : undefined,
      thinkingLevel: this.config.thinkingLevel ?? 'high',
    });

    this.session = session;
    this.session.subscribe(this.forwardEvents.bind(this));
    this.ready = true;
  }

  /**
   * Forward SDK events to our emitter
   */
  private forwardEvents(event: AgentSessionEvent): void {
    switch (event.type) {
      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          this.emit('token', {
            agentId: this.config.id,
            delta: event.assistantMessageEvent.delta,
          } as AgentTokenEvent);
        }
        if (event.assistantMessageEvent.type === 'thinking_delta') {
          this.emit('thinking', {
            agentId: this.config.id,
            delta: event.assistantMessageEvent.delta,
          } as AgentThinkingEvent);
        }
        break;

      case 'tool_execution_start':
        this.emit('tool_start', {
          agentId: this.config.id,
          tool: event.toolName,
          input: event.input,
        } as ToolStartEvent);
        break;

      case 'tool_execution_end':
        this.emit('tool_end', {
          agentId: this.config.id,
          tool: event.toolName,
          result: event.result,
          isError: event.isError,
        } as ToolEndEvent);
        break;

      case 'agent_end':
        this.emit('complete', {
          agentId: this.config.id,
          reason: event.reason,
          messages: event.messages,
        } as AgentCompleteEvent & { agentId: string });
        break;
    }
  }

  /**
   * Send a prompt to the agent
   */
  async prompt(message: string): Promise<void> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    this.updateStatus(this.getRoleStatus());
    await this.session.prompt(message);
    this.updateStatus('idle');
  }

  /**
   * Abort current operation
   */
  async stop(): Promise<void> {
    if (this.session) {
      await this.session.abort();
    }
    this.updateStatus('idle');
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    this.ready = false;
    this.removeAllListeners();
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  // ============================================
  // Abstract Methods
  // ============================================

  /**
   * Get tools specific to this agent role
   */
  abstract getTools(): any[];

  /**
   * Get system prompt for this agent role
   */
  abstract getSystemPrompt(): string;

  /**
   * Get status for when agent is actively working
   */
  abstract getRoleStatus(): AgentStatus;

  // ============================================
  // Protected Helpers
  // ============================================

  protected updateStatus(status: AgentStatus): void {
    this.status = status;
    this.emit('status_change', {
      agentId: this.config.id,
      status,
    });
  }

  /**
   * Execute command in sandbox container
   */
  protected async executeInSandbox(
    command: string,
    timeout?: number
  ): Promise<{ output: string; exitCode: number }> {
    if (!this.containerManager || !this.config.containerId) {
      throw new Error('Sandbox not available');
    }

    return this.containerManager.execute(
      this.config.containerId,
      command,
      { timeout }
    );
  }

  /**
   * Get git status from worktree
   */
  protected async getGitStatus() {
    if (!this.worktreeManager || !this.config.worktreePath) {
      return null;
    }

    return this.worktreeManager.getStatus(this.config.worktreePath);
  }

  /**
   * Commit changes to worktree
   */
  protected async commitChanges(message: string): Promise<string> {
    if (!this.worktreeManager || !this.config.worktreePath) {
      throw new Error('Worktree not available');
    }

    return this.worktreeManager.commit(this.config.worktreePath, message);
  }
}

// ============================================
// Planner Agent
// ============================================

export class PlannerAgent extends BaseAgent {
  static async create(config: AgentConfig): Promise<PlannerAgent> {
    const agent = new PlannerAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    // Read-only for planning
    return [createReadToolDefinition()];
  }

  getSystemPrompt(): string {
    return `You are a senior software architect. Your role is to break down project goals into actionable tasks.

Guidelines:
1. Analyze the user's goal carefully
2. Break into concrete tasks (backend, frontend, database, tests, etc.)
3. Consider dependencies between tasks
4. Set appropriate priorities based on critical path
5. Output tasks as structured JSON

Response format:
{
  "tasks": [
    {
      "title": "Task title",
      "type": "coding|testing|planning|review",
      "description": "Detailed description",
      "priority": "high|medium|low",
      "dependencies": [0, 2], // indices of tasks this depends on
      "estimatedTime": "1h"
    }
  ]
}`;
  }

  getRoleStatus(): AgentStatus {
    return 'planning';
  }

  /**
   * Decompose a goal into tasks
   */
  async decomposeGoal(goal: string): Promise<Task[]> {
    const prompt = `${this.getSystemPrompt()}

Project Goal: ${goal}

Analyze this goal and return a JSON array of tasks that need to be completed.`;

    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    let result = '';
    const tokenHandler = (delta: string) => {
      result += delta;
    };

    this.session.subscribe((event) => {
      if (event.type === 'message_update' && 
          event.assistantMessageEvent.type === 'text_delta') {
        tokenHandler(event.assistantMessageEvent.delta);
      }
    });

    this.updateStatus('planning');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    // Parse JSON response
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.tasks.map((t: any, index: number) => ({
          id: `task-${index}`,
          planId: '',
          type: t.type || 'coding',
          title: t.title,
          description: t.description,
          status: 'pending' as const,
          priority: t.priority || 'medium',
          dependencies: t.dependencies || [],
        }));
      }
    } catch (e) {
      console.error('Failed to parse planner output:', e);
    }

    return [];
  }
}

// ============================================
// Coder Agent
// ============================================

export class CoderAgent extends BaseAgent {
  private pendingFiles: string[] = [];

  static async create(config: AgentConfig): Promise<CoderAgent> {
    const agent = new CoderAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    // Full coding tools
    return [createReadToolDefinition(), createBashToolDefinition(), createEditToolDefinition(), createWriteToolDefinition()];
  }

  getSystemPrompt(): string {
    return `You are a senior software engineer. Generate clean, well-tested code following best practices.

Guidelines:
1. Use modern TypeScript/JavaScript patterns
2. Include JSDoc comments for complex functions
3. Write unit tests alongside code (test files: *.test.ts)
4. Follow existing project conventions
5. Use the write tool for new files, edit for modifications
6. Run tests after implementation

For file operations:
- Use write tool to create new files
- Use edit tool to modify existing files
- Use bash for npm install, npm run build, npm test

Always commit your changes with a descriptive message when done.`;
  }

  getRoleStatus(): AgentStatus {
    return 'coding';
  }

  /**
   * Implement a task
   */
  async implementTask(task: Task): Promise<TaskResult> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    const prompt = `Implement the following task:

Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}

Use the write tool to create files. Use bash to install dependencies and run tests.
When done, commit your changes.`;

    this.updateStatus('coding');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    // Get files created
    const gitStatus = await this.getGitStatus();
    const filesCreated = gitStatus?.files
      .filter(f => f.status === 'A')
      .map(f => f.path) || [];

    return {
      success: true,
      output: `Completed task: ${task.title}`,
      filesCreated,
    };
  }

  /**
   * Get list of pending/uncommitted files
   */
  async getPendingFiles(): Promise<string[]> {
    const status = await this.getGitStatus();
    return status?.files.map(f => f.path) || [];
  }
}

// ============================================
// Reviewer Agent
// ============================================

export class ReviewerAgent extends BaseAgent {
  static async create(config: AgentConfig): Promise<ReviewerAgent> {
    const agent = new ReviewerAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    return [createReadToolDefinition(), createBashToolDefinition()]; // Read + lint
  }

  getSystemPrompt(): string {
    return `You are a code reviewer. Analyze code for:
1. Correctness and edge cases
2. Security vulnerabilities
3. Performance issues
4. Code style and maintainability
5. Test coverage

Provide specific feedback with file paths and line numbers.`;
  }

  getRoleStatus(): AgentStatus {
    return 'reviewing';
  }

  /**
   * Review changes in a worktree
   */
  async reviewChanges(files?: string[]): Promise<TaskResult> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    const filesList = files?.join(', ') || 'all changed files';
    const prompt = `Review the following files: ${filesList}

Check for:
- Correctness and edge cases
- Security vulnerabilities (SQL injection, XSS, etc.)
- Performance issues
- Code style consistency
- Missing tests

Provide specific feedback for each file.`;

    this.updateStatus('reviewing');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    return {
      success: true,
      output: 'Review complete',
    };
  }
}

// ============================================
// Tester Agent
// ============================================

export class TesterAgent extends BaseAgent {
  static async create(config: AgentConfig): Promise<TesterAgent> {
    const agent = new TesterAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    return [createReadToolDefinition(), createBashToolDefinition(), createWriteToolDefinition()];
  }

  getSystemPrompt(): string {
    return `You are a QA engineer. Write comprehensive tests and verify functionality.

Guidelines:
1. Write unit tests for all new functions
2. Write integration tests for API routes
3. Cover edge cases and error conditions
4. Use descriptive test names
5. Run tests after writing

Test patterns:
- Jest/Vitest for JavaScript/TypeScript
- Follow arrange-act-assert pattern
- Mock external dependencies`;
  }

  getRoleStatus(): AgentStatus {
    return 'testing';
  }

  /**
   * Run tests and report results
   */
  async runTests(pattern?: string): Promise<TaskResult> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    const testPattern = pattern || '**/*.test.ts';
    const prompt = `Run all tests matching: ${testPattern}

Execute: npm test -- "${testPattern}"

Report the results including:
- Number of tests passed/failed
- Failed test names and error messages
- Coverage report if available`;

    this.updateStatus('testing');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    return {
      success: true,
      output: 'Tests complete',
    };
  }

  /**
   * Write tests for specific files
   */
  async writeTests(files: string[]): Promise<TaskResult> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    const prompt = `Write tests for the following files:
${files.join('\n')}

Create corresponding .test.ts files following project conventions.`;

    this.updateStatus('testing');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    return {
      success: true,
      output: 'Tests written',
    };
  }
}

// ============================================
// Debugger Agent
// ============================================

export class DebuggerAgent extends BaseAgent {
  static async create(config: AgentConfig): Promise<DebuggerAgent> {
    const agent = new DebuggerAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    return [createReadToolDefinition(), createBashToolDefinition(), createEditToolDefinition()];
  }

  getSystemPrompt(): string {
    return `You are a debugging expert. Analyze and fix failing code.

Guidelines:
1. First understand the error by reading logs and code
2. Reproduce the issue
3. Identify root cause
4. Implement minimal fix
5. Verify fix works
6. Do not introduce regressions`;
  }

  getRoleStatus(): AgentStatus {
    return 'debugging';
  }

  /**
   * Debug and fix a specific issue
   */
  async fixIssue(errorDescription: string): Promise<TaskResult> {
    if (!this.session) {
      throw new Error('Agent not initialized');
    }

    const prompt = `Debug and fix the following issue:

${errorDescription}

Steps:
1. Analyze the error and stack trace
2. Find the root cause in the code
3. Implement the fix
4. Run tests to verify`;

    this.updateStatus('debugging');
    await this.session.prompt(prompt);
    this.updateStatus('idle');

    return {
      success: true,
      output: 'Issue fixed',
    };
  }
}

// ============================================
// Agent Factory
// ============================================

export async function createAgent(
  role: AgentRole,
  config: Omit<AgentConfig, 'role'>
): Promise<BaseAgent> {
  switch (role) {
    case 'planner':
      return PlannerAgent.create(config);
    case 'coder':
      return CoderAgent.create(config);
    case 'reviewer':
      return ReviewerAgent.create(config);
    case 'tester':
      return TesterAgent.create(config);
    case 'debugger':
      return DebuggerAgent.create(config);
    default:
      throw new Error(`Unknown agent role: ${role}`);
  }
}

export type { AgentConfig };
