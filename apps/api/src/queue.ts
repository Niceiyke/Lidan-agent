import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { v4 as uuid } from 'uuid';
import type { TaskResult } from '@agentic-os/types';

// ============================================
// Redis Connection
// ============================================

export const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
    const delay = Math.min(1000 * Math.pow(2, times - 1), 30000);
    console.log(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

/**
 * Create a BullMQ worker from a processor function with error handling
 */
export function createWorker<T = any>(
  processor: (job: Job<T>) => Promise<TaskResult>
): Worker<T> {
  const worker = new Worker<T>('agent-tasks', async (job: Job<T>) => {
    try {
      const result = await processor(job);
      return result;
    } catch (error) {
      // Log error with context
      console.error(`[Worker] Job ${job.id} failed:`, error instanceof Error ? error.message : error);
      
      // Check if job should be retried
      const shouldRetry = job.attemptsMade < (job.opts.attempts || 3);
      
      if (shouldRetry) {
        console.log(`[Worker] Job ${job.id} will retry (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3})`);
      }
      
      throw error; // Re-throw to trigger BullMQ retry
    }
  }, {
    connection: redisConnection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  });
  
  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed in ${job.processingTime}ms`);
  });
  
  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed permanently:`, err.message);
  });
  
  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });
  
  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled`);
  });
  
  return worker;
}

// ============================================
// Queue Types
// ============================================

export interface TaskJob {
  taskId: string;
  projectId: string;
  planId: string;
  type: 'planning' | 'coding' | 'review' | 'testing' | 'debugging';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  parentTaskId?: string;
  dependencies?: string[];
  worktreePath?: string;
  branchName?: string;
  assignedAgentId?: string;
}

export interface ExecutionJob {
  executionId: string;
  containerId: string;
  taskId?: string;
  type: 'build' | 'test' | 'lint' | 'execute' | 'install';
  command: string;
  timeout?: number;
}

// ============================================
// Queues
// ============================================

// Task queue for agent execution
export const taskQueue = new Queue<TaskJob>('agent-tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Execution queue for container commands
export const executionQueue = new Queue<ExecutionJob>('executions', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 500,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// ============================================
// Queue Names (for reference)
// ============================================

export const QUEUES = {
  TASKS: 'agent-tasks',
  EXECUTIONS: 'executions',
} as const;

// ============================================
// Task Queue Operations
// ============================================

/**
 * Add a task to the queue
 */
export async function addTaskJob(data: Omit<TaskJob, 'taskId'>): Promise<string> {
  const jobId = uuid();
  
  const priorityMap = {
    critical: 1,
    high: 2,
    medium: 5,
    low: 10,
  };
  
  await taskQueue.add(data.type, data, {
    jobId,
    priority: priorityMap[data.priority] || 5,
  });
  
  return jobId;
}

/**
 * Add multiple tasks for parallel execution
 */
export async function addTaskJobs(tasks: Omit<TaskJob, 'taskId'>[]): Promise<string[]> {
  const jobs = tasks.map((data) => {
    const jobId = uuid();
    
    const priorityMap = {
      critical: 1,
      high: 2,
      medium: 5,
      low: 10,
    };
    
    return {
      name: data.type,
      data: { ...data, taskId: jobId },
      opts: {
        jobId,
        priority: priorityMap[data.priority] || 5,
      },
    };
  });
  
  await taskQueue.addBulk(jobs);
  
  return jobs.map((j) => j.opts?.jobId as string);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: string = QUEUES.TASKS): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = queueName === QUEUES.TASKS ? taskQueue : executionQueue;
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  
  return { waiting, active, completed, failed, delayed };
}

/**
 * Pause/Resume queues
 */
export async function pauseQueues(): Promise<void> {
  await taskQueue.pause();
  await executionQueue.pause();
}

export async function resumeQueues(): Promise<void> {
  await taskQueue.resume();
  await executionQueue.resume();
}

/**
 * Clean old jobs
 */
export async function cleanOldJobs(
  grace: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  const removed = await taskQueue.clean(grace, 100, 'completed');
  console.log(`Cleaned ${removed} completed jobs`);
}

// ============================================
// Execution Queue Operations
// ============================================

/**
 * Add an execution job
 */
export async function addExecutionJob(data: ExecutionJob): Promise<string> {
  const jobId = uuid();
  
  await executionQueue.add(data.type, { ...data, executionId: jobId }, {
    jobId,
    timeout: data.timeout ? data.timeout * 1000 : 60000,
  });
  
  return jobId;
}

/**
 * Get job by ID
 */
export async function getJob(jobId: string): Promise<Job | undefined> {
  return taskQueue.getJob(jobId);
}

/**
 * Get job progress
 */
export async function getJobProgress(jobId: string): Promise<number> {
  const job = await taskQueue.getJob(jobId);
  return job?.progress || 0;
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const job = await taskQueue.getJob(jobId);
  
  if (!job) return false;
  
  const state = await job.getState();
  
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    return true;
  }
  
  if (state === 'active') {
    await job.abort();
    return true;
  }
  
  return false;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<void> {
  const job = await taskQueue.getJob(jobId);
  
  if (job && (await job.getState()) === 'failed') {
    await job.retry();
  }
}

// ============================================
// Event Names (for reference)
// ============================================

export const EVENTS = {
  TASK_QUEUED: 'task:queued',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_BLOCKED: 'task:blocked',
} as const;
