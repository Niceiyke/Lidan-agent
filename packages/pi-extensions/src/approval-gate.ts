import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

/**
 * Approval Gate Extension
 * Intercepts potentially dangerous operations and requests human approval
 * via the Agentic OS approval system.
 */
export default function approvalGate(pi: ExtensionAPI) {
  // Track pending approvals
  let pendingApprovalId: string | null = null;

  // ============================================
  // Dangerous Operation Patterns
  // ============================================

  const APPROVAL_PATTERNS = [
    {
      pattern: /rm\s+-rf/,
      action: 'delete_files',
      description: 'Recursive file deletion',
      severity: 'high',
    },
    {
      pattern: /DROP\s+TABLE/i,
      action: 'database_drop',
      description: 'Database table deletion',
      severity: 'critical',
    },
    {
      pattern: /DROP\s+DATABASE/i,
      action: 'database_drop',
      description: 'Database deletion',
      severity: 'critical',
    },
    {
      pattern: /ALTER\s+TABLE.*DROP/i,
      action: 'database_alter',
      description: 'Dropping database column',
      severity: 'high',
    },
    {
      pattern: /git\s+push\s+--force/,
      action: 'git_force_push',
      description: 'Force push to remote',
      severity: 'high',
    },
    {
      pattern: /git\s+push\s+-f/,
      action: 'git_force_push',
      description: 'Force push to remote',
      severity: 'high',
    },
    {
      pattern: /\${.*}/s,  // Template injection
      action: 'template_injection',
      description: 'Potential template injection',
      severity: 'medium',
    },
    {
      pattern: /eval\s*\(/,
      action: 'eval_code',
      description: 'Dynamic code evaluation',
      severity: 'high',
    },
    {
      pattern: /exec\s*\(/,
      action: 'exec_code',
      description: 'Shell execution',
      severity: 'high',
    },
    {
      pattern: /chmod\s+777/,
      action: 'permission_change',
      description: 'World-writable permission',
      severity: 'medium',
    },
    {
      pattern: /chmod\s+000/,
      action: 'permission_change',
      description: 'Removing all permissions',
      severity: 'high',
    },
    {
      pattern: /sudo\s+/,
      action: 'sudo_command',
      description: 'Privileged command execution',
      severity: 'medium',
    },
    {
      pattern: /curl.*https?:\/\/[^\s]+\.exe/,
      action: 'download_executable',
      description: 'Downloading executable from URL',
      severity: 'high',
    },
    {
      pattern: /wget.*https?:\/\/[^\s]+\.exe/,
      action: 'download_executable',
      description: 'Downloading executable from URL',
      severity: 'high',
    },
    {
      pattern: /uninstall.*-g\s+node/,
      action: 'remove_runtime',
      description: 'Removing Node.js runtime',
      severity: 'critical',
    },
    {
      pattern: /npm\s+logout/,
      action: 'logout_registry',
      description: 'Logging out from npm registry',
      severity: 'low',
    },
  ];

  // ============================================
  // API Configuration
  // ============================================

  const getApiUrl = () => process.env.AGENTIC_API_URL || 'http://localhost:3001';
  const getAgentId = () => (pi.getContext?.() as any)?.agentId || 'unknown';

  // ============================================
  // Create Approval Request
  // ============================================

  async function createApprovalRequest(
    action: string,
    description: string,
    payload: Record<string, unknown>
  ): Promise<string | null> {
    try {
      const response = await fetch(`${getApiUrl()}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: getAgentId(),
          action,
          description,
          payload,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (error) {
      console.error('[approval-gate] Failed to create approval request:', error);
    }
    return null;
  }

  // ============================================
  // Check Approval Status
  // ============================================

  async function checkApprovalStatus(approvalId: string): Promise<'approved' | 'rejected' | 'pending'> {
    try {
      const response = await fetch(`${getApiUrl()}/api/approvals/${approvalId}`);
      if (response.ok) {
        const data = await response.json();
        return data.status;
      }
    } catch (error) {
      console.error('[approval-gate] Failed to check approval status:', error);
    }
    return 'pending';
  }

  // ============================================
  // Tool Call Interception
  // ============================================

  pi.on('tool_call', async (event, ctx) => {
    const toolName = event.toolName;
    const input = event.input as Record<string, unknown>;
    const command = (input.command as string) || JSON.stringify(input);

    // Check against approval patterns
    for (const { pattern, action, description, severity } of APPROVAL_PATTERNS) {
      if (pattern.test(command)) {
        // Show notification based on severity
        const severityIcon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : '🟡';
        
        ctx.ui.notify(
          `${severityIcon} Approval required: ${description}`,
          severity === 'critical' ? 'error' : 'warn'
        );

        // Create approval request
        const approvalId = await createApprovalRequest(
          action,
          description,
          { toolName, command, pattern: pattern.toString() }
        );

        if (approvalId) {
          pendingApprovalId = approvalId;
          
          // Wait for user response with timeout
          const timeout = 300000; // 5 minutes
          const startTime = Date.now();
          
          while (Date.now() - startTime < timeout) {
            const status = await checkApprovalStatus(approvalId);
            
            if (status === 'approved') {
              ctx.ui.notify('✅ Approval granted', 'success');
              return; // Allow the operation
            }
            
            if (status === 'rejected') {
              ctx.ui.notify('❌ Approval denied', 'error');
              return { 
                block: true, 
                reason: 'Operation denied by user approval' 
              };
            }
            
            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Timeout
          ctx.ui.notify('⏱️ Approval timeout', 'warn');
          return { 
            block: true, 
            reason: 'Approval request timed out (5 minutes)' 
          };
        }
      }
    }
  });

  // ============================================
  // Custom Command: List Pending Approvals
  // ============================================

  pi.registerCommand('pending-approvals', {
    description: 'List pending approval requests',
    async handler(args, ctx) {
      try {
        const response = await fetch(`${getApiUrl()}/api/approvals?status=pending`);
        if (response.ok) {
          const data = await response.json();
          const approvals = data.approvals || [];
          
          if (approvals.length === 0) {
            ctx.ui.notify('No pending approvals', 'info');
          } else {
            const list = approvals
              .map((a: any, i: number) => `${i + 1}. ${a.action}: ${a.description}`)
              .join('\n');
            ctx.ui.setWidget('pending-approvals', list.split('\n'));
          }
        }
      } catch (error) {
        ctx.ui.notify('Failed to fetch approvals', 'error');
      }
    },
  });

  // ============================================
  // Log that approval gate is loaded
  // ============================================

  console.log('[agentic-os] Approval gate extension loaded');
}
