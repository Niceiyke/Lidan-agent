import { spawn, exec as execChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import type { Container, ContainerStatus, Execution } from '@agentic-os/types';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const SANDBOX_IMAGE = 'agentic-os/sandbox:latest';
export const SANDBOX_DOCKERFILE = join(__dirname, '../../../Dockerfile.sandbox');

interface RunningContainer {
  containerId: string;
  containerName: string;
  projectId: string;
  worktreePath: string;
}

export interface ExecutionResult {
  output: string;
  exitCode: number;
  truncated: boolean;
}

export class ContainerManager {
  private running: Map<string, RunningContainer> = new Map();
  private prisma: any; // Will be injected
  
  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Build the sandbox Docker image
   */
  async buildImage(dockerfilePath: string = SANDBOX_DOCKERFILE): Promise<void> {
    const imageName = SANDBOX_IMAGE;
    
    // Check if image exists
    try {
      await this.exec(`docker image inspect ${imageName}`);
      console.log(`Image ${imageName} already exists`);
      return;
    } catch {
      // Image doesn't exist, build it
    }
    
    console.log(`Building sandbox image ${imageName}...`);
    await this.exec(`docker build -t ${imageName} -f ${dockerfilePath} .`);
    console.log(`Sandbox image built successfully`);
  }

  /**
   * Create and start a container for a project
   */
  async createContainer(
    projectId: string,
    worktreePath: string
  ): Promise<{ containerId: string; name: string }> {
    const containerName = `agentic-${projectId.slice(0, 8)}-${uuid().slice(0, 8)}`;
    
    // Ensure image exists
    await this.buildImage();
    
    // Create container with Docker-in-Docker support
    const createCmd = [
      'docker', 'create',
      '--name', containerName,
      '--privileged',
      '--network', 'agentic-network',
      '-v', `${worktreePath}:/workspace`,
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      '-w', '/workspace',
      '-e', 'DOCKER_HOST=unix:///var/run/docker.sock',
      '--hostname', containerName,
      SANDBOX_IMAGE,
      'tail', '-f', '/dev/null' // Keep container running
    ].join(' ');
    
    await this.exec(createCmd);
    
    // Start the container
    await this.exec(`docker start ${containerName}`);
    
    // Wait for container to be ready
    await this.waitForContainer(containerName);
    
    // Store in memory
    this.running.set(projectId, {
      containerId: containerName,
      containerName,
      projectId,
      worktreePath,
    });
    
    // Persist to database
    if (this.prisma) {
      await this.prisma.container.create({
        data: {
          id: uuid(),
          projectId,
          name: containerName,
          image: SANDBOX_IMAGE,
          status: 'running',
          worktreePath,
        },
      });
    }
    
    return { containerId: containerName, name: containerName };
  }

  /**
   * Get container ID for a project
   */
  async getContainer(projectId: string): Promise<string | null> {
    const running = this.running.get(projectId);
    if (running) return running.containerId;
    
    // Check database if not in memory
    if (this.prisma) {
      const container = await this.prisma.container.findFirst({
        where: { projectId, status: 'running' },
      });
      if (container) {
        this.running.set(projectId, {
          containerId: container.name,
          containerName: container.name,
          projectId,
          worktreePath: container.worktreePath,
        });
        return container.name;
      }
    }
    
    return null;
  }

  /**
   * Get container ID by name
   */
  async getContainerByName(name: string): Promise<string | null> {
    try {
      const { stdout } = await this.exec(`docker ps --filter name=${name} --format "{{.Names}}"`);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Execute a command in a container
   */
  async execute(
    containerName: string,
    command: string,
    options?: {
      timeout?: number;
      onOutput?: (data: string) => void;
      cwd?: string;
    }
  ): Promise<ExecutionResult> {
    const timeout = options?.timeout ?? 300; // 5 minutes default
    const cwd = options?.cwd ?? '/workspace';
    
    return new Promise((resolve) => {
      const proc = spawn('docker', [
        'exec',
        '-it',
        '-w', cwd,
        containerName,
        'sh', '-c', command
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      let output = '';
      let truncated = false;
      const maxOutput = 100000; // 100KB limit
      
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve({
          output: output + '\n[TIMEOUT: Command exceeded ' + timeout + 's]',
          exitCode: 124,
          truncated: true,
        });
      }, timeout * 1000);
      
      proc.stdout.on('data', (data) => {
        if (output.length < maxOutput) {
          output += data.toString();
          options?.onOutput?.(data.toString());
        } else if (!truncated) {
          truncated = true;
          output += '\n[OUTPUT TRUNCATED]';
        }
      });
      
      proc.stderr.on('data', (data) => {
        if (output.length < maxOutput) {
          output += data.toString();
          options?.onOutput?.(data.toString());
        }
      });
      
      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          output,
          exitCode: code ?? 0,
          truncated,
        });
      });
      
      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          output: `Execution error: ${error.message}`,
          exitCode: 1,
          truncated: false,
        });
      });
    });
  }

  /**
   * Execute with streaming output (returns callback for SSE)
   */
  async executeStreaming(
    containerName: string,
    command: string,
    onOutput: (data: string) => void,
    cwd: string = '/workspace'
  ): Promise<{ exitCode: number }> {
    return new Promise((resolve) => {
      const proc = spawn('docker', [
        'exec',
        '-it',
        '-w', cwd,
        containerName,
        'sh', '-c', command
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      proc.stdout.on('data', (data) => {
        onOutput(data.toString());
      });
      
      proc.stderr.on('data', (data) => {
        onOutput(data.toString());
      });
      
      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 0 });
      });
      
      proc.on('error', (error) => {
        onOutput(`Execution error: ${error.message}\n`);
        resolve({ exitCode: 1 });
      });
    });
  }

  /**
   * Stop and remove a container
   */
  async removeContainer(projectId: string): Promise<void> {
    const running = this.running.get(projectId);
    if (!running) return;
    
    try {
      // Stop container
      await this.exec(`docker stop ${running.containerName}`).catch(() => {});
      
      // Remove container
      await this.exec(`docker rm ${running.containerName}`).catch(() => {});
      
      // Update database
      if (this.prisma) {
        await this.prisma.container.updateMany({
          where: { projectId },
          data: { status: 'stopped' },
        });
      }
    } finally {
      this.running.delete(projectId);
    }
  }

  /**
   * Stop a container without removing it
   */
  async stopContainer(projectId: string): Promise<void> {
    const running = this.running.get(projectId);
    if (!running) return;
    
    await this.exec(`docker stop ${running.containerName}`).catch(() => {});
    
    if (this.prisma) {
      await this.prisma.container.updateMany({
        where: { projectId },
        data: { status: 'stopped' },
      });
    }
  }

  /**
   * Start a stopped container
   */
  async startContainer(projectId: string): Promise<void> {
    const running = this.running.get(projectId);
    if (running) return;
    
    if (this.prisma) {
      const container = await this.prisma.container.findFirst({
        where: { projectId, status: 'stopped' },
      });
      
      if (container) {
        await this.exec(`docker start ${container.name}`);
        await this.waitForContainer(container.name);
        
        this.running.set(projectId, {
          containerId: container.name,
          containerName: container.name,
          projectId,
          worktreePath: container.worktreePath,
        });
        
        await this.prisma.container.update({
          where: { id: container.id },
          data: { status: 'running' },
        });
      }
    }
  }

  /**
   * Copy files into a container
   */
  async copyFiles(
    containerName: string,
    sourcePath: string,
    destPath: string
  ): Promise<void> {
    await this.exec(`docker cp ${sourcePath} ${containerName}:${destPath}`);
  }

  /**
   * Read file from container
   */
  async readFile(containerName: string, filePath: string): Promise<string> {
    const { output } = await this.exec(
      `docker exec ${containerName} cat ${filePath}`
    );
    return output;
  }

  /**
   * Write file to container
   */
  async writeFile(
    containerName: string,
    filePath: string,
    content: string
  ): Promise<void> {
    // Write to a temp file first, then copy
    const tmpPath = `/tmp/write-${uuid().slice(0, 8)}.tmp`;
    
    // Create a temporary file outside container
    await fs.writeFile(tmpPath, content, 'utf-8');
    
    // Copy into container
    await this.exec(`docker cp ${tmpPath} ${containerName}:${filePath}`);
    
    // Clean up temp file
    await fs.unlink(tmpPath).catch(() => {});
  }

  /**
   * List running containers
   */
  async listContainers(): Promise<string[]> {
    const { stdout } = await this.exec(
      'docker ps --format "{{.Names}}"'
    );
    return stdout.split('\n').filter(Boolean);
  }

  /**
   * Get container logs
   */
  async getLogs(
    containerName: string,
    tail: number = 100
  ): Promise<string> {
    const { output } = await this.exec(
      `docker logs --tail ${tail} ${containerName}`
    );
    return output;
  }

  /**
   * Get container stats (CPU, memory)
   */
  async getStats(containerName: string): Promise<{
    cpu: string;
    memory: string;
  }> {
    const { output } = await this.exec(
      `docker stats --no-stream --format "{{.CPUPerc}}\t{{.MemPerc}}" ${containerName}`
    );
    
    const [cpu, memory] = output.trim().split('\t');
    return { cpu: cpu || '0%', memory: memory || '0%' };
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async waitForContainer(
    name: string,
    timeout: number = 30000
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const { stdout } = await this.exec(
          `docker ps --filter name=${name} --format "{{.Names}}"`
        );
        if (stdout.trim() === name) {
          // Give it a moment to fully initialize
          await new Promise(r => setTimeout(r, 500));
          return;
        }
      } catch {
        // Continue waiting
      }
      await new Promise(r => setTimeout(r, 500));
    }
    
    throw new Error(`Container ${name} failed to start within ${timeout}ms`);
  }

  private exec(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execChildProcess(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Docker command failed: ${command}\n${error.message}`));
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }
}
