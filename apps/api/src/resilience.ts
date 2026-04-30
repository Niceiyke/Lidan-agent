/**
 * Agentic OS - Resilience Module
 * 
 * Features:
 * - Connection retry with exponential backoff
 * - Worktree cleanup on startup
 * - Health checks with dependency status
 * - Graceful shutdown utilities
 */

import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { exec as execChildProcess } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

const exec = promisify(execChildProcess);

export interface ConnectionConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface HealthStatus {
  healthy: boolean;
  database?: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  redis?: {
    connected: boolean;
    latency?: number;
    error?: string;
  };
  docker?: {
    connected: boolean;
    error?: string;
  };
  worktrees?: {
    total: number;
    cleaned: number;
    error?: string;
  };
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: ConnectionConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries || 5;
  const initialDelay = config.initialDelay || 1000;
  const maxDelay = config.maxDelay || 30000;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = Math.min(
          initialDelay * Math.pow(2, attempt),
          maxDelay
        );
        console.log(`Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check database connectivity with retry
 */
export async function checkDatabaseHealth(
  prisma: PrismaClient,
  config: ConnectionConfig = {}
): Promise<HealthStatus['database']> {
  const start = Date.now();
  
  try {
    await withRetry(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }, config);
    
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity with retry
 */
export async function checkRedisHealth(
  redisUrl: string,
  config: ConnectionConfig = {}
): Promise<HealthStatus['redis']> {
  const start = Date.now();
  
  try {
    const redis = new Redis(redisUrl, { 
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 5000,
    });
    
    await withRetry(async () => {
      await redis.ping();
    }, config);
    
    redis.disconnect();
    
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Docker connectivity
 */
export async function checkDockerHealth(): Promise<HealthStatus['docker']> {
  try {
    await exec('docker info');
    return { connected: true };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Docker not available',
    };
  }
}

/**
 * Clean up stale worktrees on startup
 */
export async function cleanupStaleWorktrees(
  workspacesPath: string,
  maxAgeHours: number = 24
): Promise<{ total: number; cleaned: number }> {
  const worktreesDir = join(workspacesPath, 'worktrees');
  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  let cleaned = 0;
  let total = 0;
  
  try {
    // Get list of worktrees from git
    const projects = await fs.readdir(workspacesPath);
    
    for (const project of projects) {
      if (!project.startsWith('project-')) continue;
      
      const projectPath = join(workspacesPath, project);
      
      try {
        // Get list of worktrees for this project
        const result = await exec('git worktree list --porcelain', projectPath);
        const lines = result.stdout.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('worktree ')) {
            const worktreePath = line.replace('worktree ', '').trim();
            total++;
            
            try {
              const stats = await fs.stat(worktreePath);
              // Check if worktree is older than cutoff
              if (stats.mtimeMs < cutoffTime) {
                const branchMatch = lines[i + 1]?.match(/^branch refs\/heads\/(.+)$/);
                const branch = branchMatch?.[1] || 'unknown';
                
                console.log(`Cleaning stale worktree: ${basename(worktreePath)} (branch: ${branch})`);
                
                // Remove worktree
                await exec(`git worktree remove ${worktreePath} --force`, projectPath);
                cleaned++;
              }
            } catch {
              // Worktree path doesn't exist or can't be accessed
            }
          }
        }
      } catch {
        // Project might not be a git repo
      }
    }
    
    return { total, cleaned };
  } catch (error) {
    return { 
      total, 
      cleaned,
      error: error instanceof Error ? error.message : 'Cleanup failed',
    };
  }
}

/**
 * Get comprehensive health status
 */
export async function getComprehensiveHealth(
  prisma: PrismaClient,
  redisUrl: string,
  workspacesPath: string
): Promise<HealthStatus> {
  const [database, redis, docker] = await Promise.all([
    checkDatabaseHealth(prisma),
    checkRedisHealth(redisUrl),
    checkDockerHealth(),
  ]);
  
  const worktrees = await cleanupStaleWorktrees(workspacesPath, 0).catch(() => ({
    total: 0,
    cleaned: 0,
    error: 'Cleanup check failed',
  }));
  
  const healthy = database?.connected && redis?.connected && docker?.connected;
  
  return { healthy, database, redis, docker, worktrees };
}

/**
 * Wait for all dependencies to be ready
 */
export async function waitForDependencies(
  prisma: PrismaClient,
  redisUrl: string,
  timeout: number = 30000
): Promise<boolean> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const dbHealth = await checkDatabaseHealth(prisma);
    const redisHealth = await checkRedisHealth(redisUrl);
    
    if (dbHealth?.connected && redisHealth?.connected) {
      console.log('All dependencies connected!');
      return true;
    }
    
    console.log(`Waiting for dependencies... (DB: ${dbHealth?.connected}, Redis: ${redisHealth?.connected})`);
    await sleep(2000);
  }
  
  console.error('Timeout waiting for dependencies');
  return false;
}

/**
 * Circuit breaker pattern for external calls
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure > this.timeout) {
        this.state = 'half-open';
        console.log('Circuit breaker: entering half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      console.log('Circuit breaker: closed');
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      console.log('Circuit breaker: opened');
    }
  }
  
  getState(): string {
    return this.state;
  }
}
