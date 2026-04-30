import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type {
  AgentRole,
  AgentConfig,
  Task,
  TaskResult,
  AgentStatus,
  AgentTokenEvent,
  AgentThinkingEvent,
  ToolStartEvent,
  ToolEndEvent,
} from '@agentic-os/types';
import { BaseAgent, createAgent, AgentConfig as AgentConfigType } from './base-agent.js';
import { ContainerManager } from '../sandbox/container-manager.js';
import { WorktreeManager } from '../git/worktree-manager.js';

interface PooledAgent {
  id: string;
  agent: BaseAgent;
  role: AgentRole;
  projectId: string;
  taskId?: string;
  busy: boolean;
  createdAt: Date;
}

export class AgentPool extends EventEmitter {
  private agents: Map<string, PooledAgent> = new Map();
  private containerManager: ContainerManager;
  private worktreeManager: WorktreeManager;
  private prisma: any;
  private maxAgentsPerRole: Map<AgentRole, number> = new Map([
    ['planner', 1],
    ['coder', 4],
    ['reviewer', 2],
    ['tester', 2],
    ['debugger', 1],
  ]);

  constructor(
    containerManager: ContainerManager,
    worktreeManager: WorktreeManager,
    prisma: any
  ) {
    super();
    this.containerManager = containerManager;
    this.worktreeManager = worktreeManager;
    this.prisma = prisma;
  }

  /**
   * Get or create an agent for a project
   */
  async getAgent(
    projectId: string,
    role: AgentRole,
    workspacePath: string,
    containerId?: string
  ): Promise<PooledAgent> {
    // Find available agent for this role
    for (const [id, pooled] of this.agents) {
      if (
        pooled.role === role &&
        pooled.projectId === projectId &&
        !pooled.busy
      ) {
        pooled.busy = true;
        return pooled;
      }
    }

    // Check if we've hit the limit for this role
    const currentCount = this.countAgentsByRole(role);
    const max = this.maxAgentsPerRole.get(role) || 2;

    if (currentCount >= max) {
      // Return least recently used agent
      return this.getLeastRecentlyUsed(role);
    }

    // Create new agent
    const agentId = uuid();
    const config: AgentConfigType = {
      id: agentId,
      projectId,
      name: `${role}-${agentId.slice(0, 8)}`,
      role,
      workspacePath,
      containerId,
      thinkingLevel: role === 'planner' ? 'high' : 'medium',
    };

    const agent = await createAgent(role, config);

    // Setup event forwarding
    agent.on('status_change', (data: any) => this.emit('agent:status', data));
    agent.on('token', (data: AgentTokenEvent) => this.emit('agent:token', data));
    agent.on('thinking', (data: AgentThinkingEvent) => this.emit('agent:thinking', data));
    agent.on('tool_start', (data: ToolStartEvent) => this.emit('agent:tool_start', data));
    agent.on('tool_end', (data: ToolEndEvent) => this.emit('agent:tool_end', data));
    agent.on('complete', (data: any) => {
      this.emit('agent:complete', { ...data, agentId });
      this.releaseAgent(agentId);
    });

    const pooled: PooledAgent = {
      id: agentId,
      name: `agent-${role}`,
      agent,
      role,
      projectId,
      busy: true,
      createdAt: new Date(),
    };

    this.agents.set(agentId, pooled);

    // Persist to database
    if (this.prisma) {
      await this.prisma.agent.create({
        data: {
          id: agentId,
          projectId,
          name: pooled.name,
          role,
          status: 'idle',
          containerId,
        },
      });
    }

    return pooled;
  }

  /**
   * Release an agent back to the pool
   */
  releaseAgent(agentId: string): void {
    const pooled = this.agents.get(agentId);
    if (pooled) {
      pooled.busy = false;
      pooled.taskId = undefined;
    }
  }

  /**
   * Execute a task with an agent
   */
  async executeTask(
    projectId: string,
    role: AgentRole,
    task: Task,
    workspacePath: string,
    containerId?: string
  ): Promise<TaskResult> {
    const pooled = await this.getAgent(projectId, role, workspacePath, containerId);
    
    // Update database
    if (this.prisma) {
      await this.prisma.agent.update({
        where: { id: pooled.id },
        data: {
          status: role === 'planner' ? 'planning' :
                 role === 'coder' ? 'coding' :
                 role === 'reviewer' ? 'reviewing' :
                 role === 'tester' ? 'testing' : 'debugging',
          currentTaskId: task.id,
        },
      });

      await this.prisma.task.update({
        where: { id: task.id },
        data: { assignedAgentId: pooled.id, status: 'running' },
      });
    }

    pooled.taskId = task.id;

    try {
      let result: TaskResult;

      switch (role) {
        case 'planner':
          result = await this.executePlannerTask(pooled.agent as any, task);
          break;
        case 'coder':
          result = await this.executeCoderTask(pooled.agent as any, task);
          break;
        case 'reviewer':
          result = await this.executeReviewerTask(pooled.agent as any, task);
          break;
        case 'tester':
          result = await this.executeTesterTask(pooled.agent as any, task);
          break;
        case 'debugger':
          result = await this.executeDebuggerTask(pooled.agent as any, task);
          break;
        default:
          result = { success: false, error: 'Unknown role' };
      }

      // Update task status
      if (this.prisma) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            status: result.success ? 'done' : 'failed',
            result,
          },
        });
      }

      return result;
    } finally {
      this.releaseAgent(pooled.id);
    }
  }

  /**
   * Execute planner task
   */
  private async executePlannerTask(
    agent: any,
    task: Task
  ): Promise<TaskResult> {
    try {
      const tasks = await agent.decomposeGoal(task.description);
      
      // Create subtasks in database
      if (this.prisma && tasks.length > 0) {
        const planId = task.planId;
        const plan = await this.prisma.taskPlan.findUnique({
          where: { id: planId },
        });

        if (plan) {
          const createdTasks = await this.prisma.task.createMany({
            data: tasks.map((t: any, index: number) => ({
              id: uuid(),
              planId,
              type: t.type || 'coding',
              title: t.title,
              description: t.description,
              status: 'pending',
              priority: t.priority || 'medium',
              parentTaskId: task.id,
            })),
          });

          // Create dependencies
          for (const t of tasks) {
            if (t.dependencies && t.dependencies.length > 0) {
              const taskIndex = tasks.indexOf(t);
              for (const depIndex of t.dependencies) {
                if (tasks[depIndex]) {
                  await this.prisma.taskDependency.create({
                    data: {
                      taskId: taskIndex.toString(), // Will be updated with real IDs
                      dependsOnTaskId: depIndex.toString(),
                    },
                  });
                }
              }
            }
          }
        }
      }

      return {
        success: true,
        output: `Created ${tasks.length} tasks`,
        filesCreated: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute coder task
   */
  private async executeCoderTask(
    agent: any,
    task: Task
  ): Promise<TaskResult> {
    try {
      return await agent.implementTask(task);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute reviewer task
   */
  private async executeReviewerTask(
    agent: any,
    task: Task
  ): Promise<TaskResult> {
    try {
      return await agent.reviewChanges();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute tester task
   */
  private async executeTesterTask(
    agent: any,
    task: Task
  ): Promise<TaskResult> {
    try {
      return await agent.runTests();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute debugger task
   */
  private async executeDebuggerTask(
    agent: any,
    task: Task
  ): Promise<TaskResult> {
    try {
      return await agent.fixIssue(task.description);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Count agents by role
   */
  private countAgentsByRole(role: AgentRole): number {
    let count = 0;
    for (const pooled of this.agents.values()) {
      if (pooled.role === role) count++;
    }
    return count;
  }

  /**
   * Get least recently used agent for a role
   */
  private getLeastRecentlyUsed(role: AgentRole): PooledAgent {
    let oldest: PooledAgent | null = null;

    for (const pooled of this.agents.values()) {
      if (pooled.role === role && !pooled.busy) {
        if (!oldest || pooled.createdAt < oldest.createdAt) {
          oldest = pooled;
        }
      }
    }

    if (!oldest) {
      throw new Error(`No available agent for role: ${role}`);
    }

    oldest.busy = true;
    return oldest;
  }

  /**
   * Get all agents
   */
  getAllAgents(): PooledAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent by ID
   */
  getAgentById(id: string): PooledAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * Shutdown all agents
   */
  async shutdown(): Promise<void> {
    for (const pooled of this.agents.values()) {
      pooled.agent.dispose();
    }
    this.agents.clear();
  }

  /**
   * Remove agent from pool
   */
  async removeAgent(agentId: string): Promise<void> {
    const pooled = this.agents.get(agentId);
    if (pooled) {
      pooled.agent.dispose();
      this.agents.delete(agentId);
    }
  }
}
