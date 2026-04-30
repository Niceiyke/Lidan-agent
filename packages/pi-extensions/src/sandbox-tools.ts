import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from 'typebox';

/**
 * Sandbox-safe execution tools for Pi agents.
 * These tools route dangerous operations through a sandboxed container.
 */
export default function sandboxTools(pi: ExtensionAPI) {
  const context = pi.getContext?.() || {};
  const containerId = (context as any).containerId || process.env.AGENTIC_CONTAINER_ID;

  // ============================================
  // Dangerous Command Detection
  // ============================================

  const DANGEROUS_PATTERNS = [
    /rm\s+-rf\s+\/(?!workspace)/,           // rm -rf / (except /workspace which is fine)
    /mkfs/,                                   // Format disk
    /:\(\)\s*:\s*\|\s*:&\s*;\s*: \(\)/,     // Fork bomb
    /dd\s+if=/,                              // Direct disk read
    />\s*\/dev\/sd/,                         // Writing to disk device
    /chmod\s+-R\s+777\s+\/(?!workspace)/,   // World-writable system files
    /curl.*\|.*sh/,                          // Pipe curl to shell
    /wget.*\|.*sh/,                          // Pipe wget to shell
    / nc\s+-[dle]/,                          // Netcat backdoor
    /eval\s+.*\$/,                           // Eval with variable expansion
  ];

  // ============================================
  // Dangerous Tool Call Interception
  // ============================================

  pi.on('tool_call', async (event, ctx) => {
    const toolName = event.toolName;
    const input = event.input as Record<string, unknown>;

    // Check bash commands
    if (toolName === 'bash' || toolName === 'shell') {
      const command = (input.command as string) || (input[0] as string) || '';

      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          const confirmed = await ctx.ui.confirm(
            'Security Warning',
            `Potentially dangerous command detected:\n\n${command}\n\nThis command will be blocked. Continue?`
          );

          if (!confirmed) {
            return { 
              block: true, 
              reason: 'Dangerous command blocked by sandbox security' 
            };
          }

          // Log for audit
          ctx.ui.notify(`Dangerous command pattern detected: ${pattern}`, 'warn');
          return { 
            block: true, 
            reason: 'Pattern matches known dangerous commands' 
          };
        }
      }

      // Block commands outside workspace
      if (command.includes('cd /') && !command.includes('/workspace') && !command.includes('/app')) {
        ctx.ui.notify('Access to system directories is restricted to /workspace', 'info');
        return { 
          block: true, 
          reason: 'Only /workspace directory is accessible' 
        };
      }
    }

    // Check file writes to sensitive locations
    if (toolName === 'write' || toolName === 'edit') {
      const path = (input.path as string) || (input[0] as string) || '';

      if (path.includes('.env') && !path.includes('/workspace')) {
        ctx.ui.notify('Environment files can only be created in project workspace', 'warn');
      }

      if (path.includes('node_modules/.bin') || path.includes('/usr/bin')) {
        return {
          block: true,
          reason: 'Cannot modify system binaries',
        };
      }
    }
  });

  // ============================================
  // Safe Execution Tool
  // ============================================

  pi.registerTool({
    name: 'sandbox_exec',
    label: 'Execute in Sandbox',
    description: 'Execute a command in the isolated Docker sandbox container. Use this for builds, installs, and tests.',
    parameters: Type.Object({
      command: Type.String({ description: 'Command to execute' }),
      timeout: Type.Optional(Type.Number({ description: 'Timeout in seconds', default: 60 })),
      cwd: Type.Optional(Type.String({ description: 'Working directory', default: '/workspace' })),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const command = params.command as string;
      const timeout = (params.timeout as number) || 60;
      const cwd = (params.cwd as string) || '/workspace';

      if (!containerId) {
        return {
          content: [{ type: 'text', text: 'Sandbox not available' }],
          details: { error: 'No container ID' },
          isError: true,
        };
      }

      return new Promise((resolve) => {
        const proc = spawn('docker', [
          'exec',
          '-it',
          '-w', cwd,
          containerId,
          'sh', '-c', command
        ], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let output = '';
        const maxOutput = 100000;

        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve({
            content: [{ type: 'text', text: output + '\n[TIMEOUT]' }],
            details: { exitCode: 124, truncated: true },
            isError: true,
          });
        }, timeout * 1000);

        proc.stdout.on('data', (data) => {
          const chunk = data.toString();
          if (output.length < maxOutput) {
            output += chunk;
            onUpdate?.({ type: 'stdout', data: chunk });
          }
        });

        proc.stderr.on('data', (data) => {
          const chunk = data.toString();
          if (output.length < maxOutput) {
            output += chunk;
            onUpdate?.({ type: 'stderr', data: chunk });
          }
        });

        proc.on('close', (code) => {
          clearTimeout(timer);
          resolve({
            content: [{ type: 'text', text: output }],
            details: { exitCode: code ?? 0 },
            isError: code !== 0,
          });
        });

        proc.on('error', (error) => {
          clearTimeout(timer);
          resolve({
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            details: { error: error.message },
            isError: true,
          });
        });

        // Handle abort signal
        if (signal?.aborted) {
          proc.kill();
          resolve({
            content: [{ type: 'text', text: 'Execution cancelled' }],
            details: { cancelled: true },
            isError: true,
          });
        }
      });
    },
  });

  // ============================================
  // Container Stats Tool
  // ============================================

  pi.registerTool({
    name: 'container_stats',
    label: 'Container Stats',
    description: 'Get CPU and memory usage of the sandbox container',
    parameters: Type.Object({}),
    async execute(toolCallId, params, signal) {
      if (!containerId) {
        return {
          content: [{ type: 'text', text: 'Sandbox not available' }],
          isError: true,
        };
      }

      return new Promise((resolve) => {
        const proc = spawn('docker', [
          'stats', '--no-stream',
          '--format', '{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}',
          containerId
        ]);

        let output = '';
        proc.stdout.on('data', (d) => { output += d; });
        proc.on('close', () => {
          const [cpu, mem, memUsage] = output.trim().split('\t');
          resolve({
            content: [{
              type: 'text',
              text: `CPU: ${cpu || 'N/A'}\nMemory: ${mem || 'N/A'} (${memUsage || 'N/A'})`,
            }],
          });
        });
        proc.on('error', () => {
          resolve({
            content: [{ type: 'text', text: 'Failed to get stats' }],
            isError: true,
          });
        });
      });
    },
  });

  // ============================================
  // File Listing Tool
  // ============================================

  pi.registerTool({
    name: 'list_files',
    label: 'List Files',
    description: 'List files in a directory with details',
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: 'Directory path', default: '.' })),
      recursive: Type.Optional(Type.Boolean({ description: 'Recursive listing', default: false })),
    }),
    async execute(toolCallId, params) {
      const path = (params.path as string) || '/workspace';
      const recursive = (params.recursive as boolean) || false;
      const flag = recursive ? '-R' : '';

      return new Promise((resolve) => {
        const proc = spawn('sh', ['-c', `ls -la ${flag} ${path} 2>&1`]);
        let output = '';

        proc.stdout.on('data', (d) => { output += d; });
        proc.stderr.on('data', (d) => { output += d; });

        proc.on('close', (code) => {
          resolve({
            content: [{ type: 'text', text: output || 'No files found' }],
            details: { exitCode: code },
            isError: code !== 0,
          });
        });
      });
    },
  });

  // ============================================
  // Installation Helper
  // ============================================

  pi.registerTool({
    name: 'install_deps',
    label: 'Install Dependencies',
    description: 'Install npm dependencies in the workspace',
    parameters: Type.Object({
      package: Type.Optional(Type.String({ description: 'Package to install (default: all)' })),
      dev: Type.Optional(Type.Boolean({ description: 'Install as dev dependency', default: false })),
    }),
    async execute(toolCallId, params) {
      const packageName = params.package as string;
      const isDev = (params.dev as boolean) || false;
      const installCmd = packageName
        ? `npm install ${isDev ? '-D ' : ''}${packageName}`
        : 'npm install';

      return this.execute(toolCallId, { command: installCmd, timeout: 120 }, undefined, undefined, pi);
    },
  });

  // Log that sandbox extension is loaded
  console.log('[agentic-os] Sandbox tools extension loaded');
}
