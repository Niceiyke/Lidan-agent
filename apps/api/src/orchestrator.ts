import { v4 as uuid } from 'uuid';
import { PrismaClient } from '@prisma/client';
import type {
  Task,
  TaskResult,
  Project,
  ProjectStatus,
  AgentJob,
} from '@agentic-os/types';
import { AgentPool } from './agents/agent-pool.js';
import { ContainerManager } from './sandbox/container-manager.js';
import { WorktreeManager } from './git/worktree-manager.js';
import { SSEBroadcaster } from './sse.js';

export interface OrchestratorConfig {
  workspacesPath: string;
  prisma: PrismaClient;
  sse: SSEBroadcaster;
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private containerManager: ContainerManager;
  public worktreeManager: WorktreeManager;
  public agentPool: AgentPool;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.containerManager = new ContainerManager(config.prisma);
    this.worktreeManager = new WorktreeManager(config.workspacesPath);
    this.agentPool = new AgentPool(
      this.containerManager,
      this.worktreeManager,
      config.prisma
    );

    // Forward agent events to SSE
    this.agentPool.on('agent:status', (data) => {
      config.sse.broadcast('agent:status', data);
    });
    this.agentPool.on('agent:token', (data) => {
      config.sse.broadcast('agent:token', data);
    });
    this.agentPool.on('agent:tool_start', (data) => {
      config.sse.broadcast('agent:tool_start', data);
    });
    this.agentPool.on('agent:tool_end', (data) => {
      config.sse.broadcast('agent:tool_end', data);
    });
    this.agentPool.on('agent:complete', (data) => {
      config.sse.broadcast('agent:complete', data);
    });
  }

  // ============================================
  // Project Management
  // ============================================

  /**
   * Create a new project with workspace
   */
  async createProject(
    name: string,
    goal: string,
    userId?: string
  ): Promise<Project> {
    const projectId = uuid();
    const effectiveUserId = userId || 'default';
    
    // Ensure user exists
    await this.config.prisma.user.upsert({
      where: { id: effectiveUserId },
      create: { id: effectiveUserId, email: `${effectiveUserId}@agentic-os.local` },
      update: {},
    });
    
    // Initialize git repo and worktree
    const workspacePath = await this.worktreeManager.initProjectRepo(projectId);
    
    // Create project in database
    const project = await this.config.prisma.project.create({
      data: {
        id: projectId,
        userId: effectiveUserId,
        name,
        goal,
        status: 'planning',
        workspacePath,
        mainBranch: 'main',
      },
    });

    // Create initial task plan
    await this.config.prisma.taskPlan.create({
      data: {
        id: uuid(),
        projectId,
        goal,
      },
    });

    this.config.sse.broadcast('project:created', { projectId, name, goal });

    return project as unknown as Project;
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    const project = await this.config.prisma.project.findUnique({
      where: { id: projectId },
    });
    return project as unknown as Project | null;
  }

  /**
   * Update project status
   */
  async updateProjectStatus(
    projectId: string,
    status: ProjectStatus
  ): Promise<void> {
    await this.config.prisma.project.update({
      where: { id: projectId },
      data: { status },
    });
    this.config.sse.broadcast('project:status', { projectId, status });
  }

  // ============================================
  // Task Planning & Execution
  // ============================================

  /**
   * Start planning for a project
   */
  async startPlanning(projectId: string): Promise<Task> {
    const project = await this.config.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Create planning task
    const task = await this.config.prisma.task.create({
      data: {
        id: uuid(),
        planId: (await this.getLatestPlan(projectId))?.id || uuid(),
        type: 'planning',
        title: `Plan: ${project.name}`,
        description: project.goal,
        status: 'queued',
        priority: 'critical',
      },
    });

    this.config.sse.broadcast('task:created', { taskId: task.id, projectId });

    return task as unknown as Task;
  }

  /**
   * Execute a planning task
   */
  async executePlanningTask(taskId: string): Promise<TaskResult> {
    const task = await this.config.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const plan = await this.config.prisma.taskPlan.findUnique({
      where: { id: task.planId },
    });

    const project = await this.config.prisma.project.findFirst({
      where: {
        plans: {
          some: { id: task.planId },
        },
      },
    });

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Update task status
    await this.config.prisma.task.update({
      where: { id: taskId },
      data: { status: 'running' },
    });

    this.config.sse.broadcast('task:running', { taskId });

    try {
      // Create worktree for planning
      const worktree = await this.worktreeManager.createWorktree(
        project.workspacePath,
        taskId
      );

      // Get planner agent from pool
      const pooled = await this.agentPool.getAgent(
        projectId,
        'planner',
        project.workspacePath
      );

      // Execute planning
      const result = await pooled.agent.prompt(
        `Break down this goal into tasks:\n\n${task.description}`
      );

      // The planner will decompose and create subtasks in the database
      // via the agent pool's executePlannerTask method
      
      // Update task status
      await this.config.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'done',
          worktreePath: worktree.path,
          branchName: worktree.branch,
        },
      });

      this.agentPool.releaseAgent(pooled.id);
      this.config.sse.broadcast('task:done', { taskId, result });

      return {
        success: true,
        output: 'Planning complete',
      };
    } catch (error) {
      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });

      this.config.sse.broadcast('task:failed', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute a coding task
   */
  async executeCodingTask(taskId: string): Promise<TaskResult> {
    const task = await this.config.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const project = await this.config.prisma.project.findFirst({
      where: {
        tasks: { some: { id: taskId } },
      },
    });

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    // Get or create container
    let containerId = await this.containerManager.getContainer(project.id);
    
    if (!containerId) {
      const container = await this.containerManager.createContainer(
        project.id,
        project.workspacePath
      );
      containerId = container.containerId;
    }

    // Create worktree for this task
    const worktree = await this.worktreeManager.createWorktree(
      project.workspacePath,
      taskId,
      task.parentTaskId || undefined
    );

    // Update task with worktree info
    await this.config.prisma.task.update({
      where: { id: taskId },
      data: {
        branchName: worktree.branch,
        worktreePath: worktree.path,
      },
    });

    this.config.sse.broadcast('task:running', { taskId });

    try {
      const result = await this.agentPool.executeTask(
        project.id,
        'coder',
        task,
        worktree.path,
        containerId
      );

      // Update status based on result
      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: result.success ? 'done' : 'failed' },
      });

      if (result.success) {
        this.config.sse.broadcast('task:done', { taskId, result });
      } else {
        this.config.sse.broadcast('task:failed', { taskId, error: result.error });
      }

      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });

      this.config.sse.broadcast('task:failed', { taskId, error: errorResult.error });

      return errorResult;
    }
  }

  /**
   * Execute a testing task
   */
  async executeTestingTask(taskId: string): Promise<TaskResult> {
    const task = await this.config.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const project = await this.config.prisma.project.findFirst({
      where: { tasks: { some: { id: taskId } } },
    });

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const containerId = await this.containerManager.getContainer(project.id);
    if (!containerId) {
      return { success: false, error: 'Container not available' };
    }

    this.config.sse.broadcast('task:running', { taskId });

    try {
      const result = await this.agentPool.executeTask(
        project.id,
        'tester',
        task,
        project.workspacePath,
        containerId
      );

      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: result.success ? 'done' : 'failed' },
      });

      if (result.success) {
        this.config.sse.broadcast('task:done', { taskId, result });
      } else {
        this.config.sse.broadcast('task:failed', { taskId, error: result.error });
      }

      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });

      this.config.sse.broadcast('task:failed', { taskId, error: errorResult.error });

      return errorResult;
    }
  }

  /**
   * Execute a review task
   */
  async executeReviewTask(taskId: string): Promise<TaskResult> {
    const task = await this.config.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    const project = await this.config.prisma.project.findFirst({
      where: { tasks: { some: { id: taskId } } },
    });

    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const containerId = await this.containerManager.getContainer(project.id);
    if (!containerId) {
      return { success: false, error: 'Container not available' };
    }

    this.config.sse.broadcast('task:running', { taskId });

    try {
      const result = await this.agentPool.executeTask(
        project.id,
        'reviewer',
        task,
        project.workspacePath,
        containerId
      );

      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: result.success ? 'done' : 'failed' },
      });

      if (result.success) {
        this.config.sse.broadcast('task:done', { taskId, result });
      } else {
        this.config.sse.broadcast('task:failed', { taskId, error: result.error });
      }

      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      await this.config.prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed' },
      });

      this.config.sse.broadcast('task:failed', { taskId, error: errorResult.error });

      return errorResult;
    }
  }

  // ============================================
  // Dependency Management
  // ============================================

  /**
   * Check if all dependencies are met for a task
   */
  async checkDependencies(taskId: string): Promise<boolean> {
    const dependencies = await this.config.prisma.taskDependency.findMany({
      where: { taskId },
    });

    for (const dep of dependencies) {
      const task = await this.config.prisma.task.findUnique({
        where: { id: dep.dependsOnTaskId },
      });

      if (!task || task.status !== 'done') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get next available task (dependencies met, highest priority)
   */
  async getNextAvailableTask(projectId: string): Promise<Task | null> {
    const tasks = await this.config.prisma.task.findMany({
      where: {
        status: 'pending',
        plan: { projectId },
      },
      orderBy: [
        { priority: 'asc' }, // 'critical' comes first
        { createdAt: 'asc' },
      ],
    });

    for (const task of tasks) {
      const depsMet = await this.checkDependencies(task.id);
      if (depsMet) {
        return task as unknown as Task;
      }
    }

    return null;
  }

  // ============================================
  // Git Operations
  // ============================================

  /**
   * Merge a task's worktree back to main
   */
  async mergeTaskWorktree(taskId: string): Promise<void> {
    const task = await this.config.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task?.worktreePath || !task?.branchName) {
      throw new Error('Task has no worktree');
    }

    const project = await this.config.prisma.project.findFirst({
      where: { tasks: { some: { id: taskId } } },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Check for uncommitted changes
    const hasChanges = await this.worktreeManager.hasUncommittedChanges(
      task.worktreePath
    );

    if (hasChanges) {
      // Auto-commit
      await this.worktreeManager.stageFiles(task.worktreePath, ['.']);
      await this.worktreeManager.commit(task.worktreePath, `Task: ${task.title}`);
    }

    // Merge to main
    await this.worktreeManager.mergeWorktree(
      project.workspacePath,
      task.branchName,
      `Merge ${task.branchName}: ${task.title}`
    );

    // Clean up worktree
    await this.worktreeManager.deleteWorktree(project.workspacePath, task.worktreePath);

    this.config.sse.broadcast('git:merged', {
      projectId: project.id,
      branch: task.branchName,
    });
  }

  /**
   * Get git status for a project
   */
  async getProjectGitStatus(projectId: string): Promise<any> {
    const project = await this.config.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return this.worktreeManager.getStatus(project.workspacePath);
  }

  // ============================================
  // Utility
  // ============================================

  private async getLatestPlan(projectId: string) {
    return this.config.prisma.taskPlan.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cleanup resources for a project
   */
  async cleanupProject(projectId: string): Promise<void> {
    // Stop containers
    await this.containerManager.removeContainer(projectId);

    // Remove agent pool entries
    const agents = await this.config.prisma.agent.findMany({
      where: { projectId },
    });

    for (const agent of agents) {
      await this.agentPool.removeAgent(agent.id);
    }
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    await this.agentPool.shutdown();
  }
}
