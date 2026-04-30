import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { SSEBroadcaster } from './sse.js';
import { Orchestrator, OrchestratorConfig } from './orchestrator.js';
import { 
  TaskJob, 
  ExecutionJob, 
  createWorker,
  executionQueue,
  addExecutionJob,
  getQueueStats,
} from './queue.js';
import { ContainerManager, ExecutionResult } from './sandbox/container-manager.js';
import { v4 as uuid } from 'uuid';
import type { TaskResult } from '@agentic-os/types';

// ============================================
// Worker Configuration
// ============================================

const WORKSACES_PATH = process.env.WORKSPACES_PATH || '/tmp/agentic-workspaces';
const MAX_CONCURRENT_TASKS = parseInt(process.env.MAX_CONCURRENT_TASKS || '5', 10);
const EXECUTION_TIMEOUT = parseInt(process.env.EXECUTION_TIMEOUT || '300', 10);

// ============================================
// Worker State
// ============================================

let prisma: PrismaClient;
let orchestrator: Orchestrator;
let containerManager: ContainerManager;
let sse: SSEBroadcaster;
let taskWorker: any;
let executionWorker: any;

// ============================================
// Initialize Workers
// ============================================

export async function startWorkers(
  sseBroadcaster: SSEBroadcaster,
  prismaClient: PrismaClient
): Promise<void> {
  sse = sseBroadcaster;
  prisma = prismaClient;
  
  // Initialize orchestrator with dependencies
  const config: OrchestratorConfig = {
    workspacesPath: WORKSACES_PATH,
    prisma,
    sse,
  };
  
  orchestrator = new Orchestrator(config);
  containerManager = new ContainerManager(prisma);
  
  console.log('Starting Agentic OS workers...');
  
  // Start task worker
  await startTaskWorker();
  
  // Start execution worker
  await startExecutionWorker();
  
  console.log(`Workers started (max concurrent: ${MAX_CONCURRENT_TASKS})`);
}

// ============================================
// Task Worker
// ============================================

async function startTaskWorker(): Promise<void> {
  const { createWorker } = await import('./queue.js');
  
  taskWorker = createWorker(async (job: Job<TaskJob>): Promise<TaskResult> => {
    const { taskId, projectId, type, description, priority } = job.data;
    const startTime = Date.now();
    
    console.log(`[Worker] Processing task ${taskId} (${type})`);
    
    try {
      // Update task status
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'running' },
      });
      
      sse.broadcast('task:running', { taskId, type, priority });
      
      // Check dependencies
      const depsMet = await orchestrator.checkDependencies(taskId);
      if (!depsMet) {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: 'blocked' },
        });
        
        sse.broadcast('task:blocked', { taskId, reason: 'Dependencies not met' });
        
        return {
          success: false,
          error: 'Dependencies not met - task blocked',
        };
      }
      
      // Get project info
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      
      if (!project) {
        return {
          success: false,
          error: `Project not found: ${projectId}`,
        };
      }
      
      // Get or create container
      let containerId = await containerManager.getContainer(projectId);
      
      if (!containerId) {
        const container = await containerManager.createContainer(
          projectId,
          project.workspacePath
        );
        containerId = container.containerId;
        
        sse.broadcast('container:created', { 
          projectId, 
          containerId,
          containerName: container.name
        });
      }
    
    try {
      let result: TaskResult;
      
      switch (type) {
        case 'planning':
          result = await executePlanningTask(taskId, project, job);
          break;
          
        case 'coding':
          result = await executeCodingTask(taskId, project, job);
          break;
          
        case 'review':
          result = await executeReviewTask(taskId, project, job);
          break;
          
        case 'testing':
          result = await executeTestingTask(taskId, project, job);
          break;
          
        case 'debugging':
          result = await executeDebuggingTask(taskId, project, job);
          break;
          
        default:
          result = { success: true, output: `Task ${type} completed` };
      }
      
      // Update task with result
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.success ? 'done' : 'failed',
          result,
          duration: job.finishedOn ? job.processedOn ? job.finishedOn - job.processedOn : undefined : undefined,
        },
      });
      
      if (result.success) {
        sse.broadcast('task:done', { taskId, result });
      } else {
        sse.broadcast('task:failed', { taskId, error: result.error });
      }
      
      return result;
      
    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'failed', result: errorResult },
      });
      
      sse.broadcast('task:failed', { taskId, error: errorResult.error });
      
      throw error;
    }
  });
  
  // Event handlers
  taskWorker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} completed`);
    sse.broadcast('job:completed', { jobId: job.id, result });
  });
  
  taskWorker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);
    sse.broadcast('job:failed', { jobId: job?.id, error: error.message });
  });
  
  taskWorker.on('stalled', (job) => {
    console.warn(`[Worker] Job ${job?.id} stalled`);
    sse.broadcast('job:stalled', { jobId: job?.id });
  });
}

// ============================================
// Execution Worker
// ============================================

async function startExecutionWorker(): Promise<void> {
  const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
  
  const { Queue, Worker } = await import('bullmq');
  const execQueue = new Queue<ExecutionJob>('executions', { connection: redisConnection });
  
  executionWorker = new Worker<ExecutionJob>(
    'executions',
    async (job: Job<ExecutionJob>): Promise<ExecutionResult> => {
      const { executionId, containerId, taskId, type, command, timeout } = job.data;
      
      console.log(`[ExecWorker] Execution ${executionId} (${type})`);
      
      // Create execution record
      const execution = await prisma.execution.create({
        data: {
          id: executionId,
          containerId,
          taskId,
          type,
          status: 'running',
          command,
        },
      });
      
      sse.broadcast('execution:started', { executionId, containerId, type });
      
      try {
        // Execute in container
        const result = await containerManager.execute(
          containerId,
          command,
          { timeout: timeout || EXECUTION_TIMEOUT }
        );
        
        // Update execution record
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: result.exitCode === 0 ? 'success' : 'failed',
            output: result.output,
            exitCode: result.exitCode,
            finishedAt: new Date(),
          },
        });
        
        sse.broadcast('execution:completed', { 
          executionId, 
          exitCode: result.exitCode,
          truncated: result.truncated,
        });
        
        return result;
        
      } catch (error) {
        await prisma.execution.update({
          where: { id: executionId },
          data: {
            status: 'failed',
            output: error instanceof Error ? error.message : 'Unknown error',
            exitCode: 1,
            finishedAt: new Date(),
          },
        });
        
        sse.broadcast('execution:failed', { executionId, error: error instanceof Error ? error.message : 'Unknown error' });
        
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // More concurrent executions than tasks
    }
  );
  
  executionWorker.on('completed', (job, result) => {
    console.log(`[ExecWorker] ${job.id} completed with exit code ${result.exitCode}`);
  });
  
  executionWorker.on('failed', (job, error) => {
    console.error(`[ExecWorker] ${job?.id} failed:`, error.message);
  });
}

// ============================================
// Task Execution Handlers
// ============================================

async function executePlanningTask(
  taskId: string,
  project: any,
  job: Job<TaskJob>
): Promise<TaskResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Create worktree for planning
  const worktree = await orchestrator.worktreeManager.createWorktree(
    project.workspacePath,
    taskId
  );
  
  // Update task with worktree info
  await prisma.task.update({
    where: { id: taskId },
    data: {
      worktreePath: worktree.path,
      branchName: worktree.branch,
    },
  });
  
  sse.broadcast('worktree:created', { taskId, branch: worktree.branch, path: worktree.path });
  
  try {
    // Execute planning via orchestrator
    const result = await orchestrator.executePlanningTask(taskId);
    
    // Create subtasks in database based on planner output
    // This would parse the planner's response and create Task records
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Planning failed',
    };
  }
}

async function executeCodingTask(
  taskId: string,
  project: any,
  job: Job<TaskJob>
): Promise<TaskResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Get parent task's worktree if this task has dependencies
  let worktreePath = project.workspacePath;
  let branchName = 'main';
  
  if (task.parentTaskId) {
    const parent = await prisma.task.findUnique({
      where: { id: task.parentTaskId },
    });
    
    if (parent?.worktreePath) {
      worktreePath = parent.worktreePath;
      branchName = parent.branchName || 'main';
    }
  }
  
  // Create new worktree for this task
  const worktree = await orchestrator.worktreeManager.createWorktree(
    project.workspacePath,
    taskId,
    branchName
  );
  
  // Update task with worktree info
  await prisma.task.update({
    where: { id: taskId },
    data: {
      worktreePath: worktree.path,
      branchName: worktree.branch,
    },
  });
  
  sse.broadcast('worktree:created', { taskId, branch: worktree.branch, path: worktree.path });
  
  // Get container
  const containerId = await containerManager.getContainer(project.id);
  
  if (!containerId) {
    return { success: false, error: 'Container not available' };
  }
  
  // Execute coding via agent pool
  const result = await orchestrator.agentPool.executeTask(
    project.id,
    'coder',
    task as any,
    worktree.path,
    containerId
  );
  
  return result;
}

async function executeReviewTask(
  taskId: string,
  project: any,
  job: Job<TaskJob>
): Promise<TaskResult> {
  const containerId = await containerManager.getContainer(project.id);
  
  if (!containerId) {
    return { success: false, error: 'Container not available' };
  }
  
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Execute review via agent pool
  const result = await orchestrator.agentPool.executeTask(
    project.id,
    'reviewer',
    task as any,
    project.workspacePath,
    containerId
  );
  
  return result;
}

async function executeTestingTask(
  taskId: string,
  project: any,
  job: Job<TaskJob>
): Promise<TaskResult> {
  const containerId = await containerManager.getContainer(project.id);
  
  if (!containerId) {
    return { success: false, error: 'Container not available' };
  }
  
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Execute testing via agent pool
  const result = await orchestrator.agentPool.executeTask(
    project.id,
    'tester',
    task as any,
    project.workspacePath,
    containerId
  );
  
  return result;
}

async function executeDebuggingTask(
  taskId: string,
  project: any,
  job: Job<TaskJob>
): Promise<TaskResult> {
  const containerId = await containerManager.getContainer(project.id);
  
  if (!containerId) {
    return { success: false, error: 'Container not available' };
  }
  
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Execute debugging via agent pool
  const result = await orchestrator.agentPool.executeTask(
    project.id,
    'debugger',
    task as any,
    project.workspacePath,
    containerId
  );
  
  return result;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Stop all workers gracefully
 */
export async function stopWorkers(): Promise<void> {
  console.log('Stopping workers...');
  
  if (taskWorker) {
    await taskWorker.close();
  }
  
  if (executionWorker) {
    await executionWorker.close();
  }
  
  console.log('Workers stopped');
}

/**
 * Get worker status
 */
export async function getWorkerStatus(): Promise<{
  taskWorker: { waiting: number; active: number; completed: number; failed: number };
  executionWorker: { waiting: number; active: number; completed: number; failed: number };
}> {
  const taskStats = await getQueueStats('agent-tasks');
  const execStats = await getQueueStats('executions');
  
  return {
    taskWorker: taskStats,
    executionWorker: execStats,
  };
}
