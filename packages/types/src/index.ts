// Agentic OS Shared Types

// ============================================
// Core Types
// ============================================

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'tester' | 'debugger';
export type AgentStatus = 'idle' | 'planning' | 'coding' | 'reviewing' | 'testing' | 'debugging' | 'waiting_approval' | 'done' | 'failed';

export type TaskType = 'planning' | 'coding' | 'review' | 'testing' | 'debugging';
export type TaskStatus = 'pending' | 'queued' | 'running' | 'done' | 'failed' | 'blocked' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout' | 'cancelled';
export type ProjectStatus = 'planning' | 'building' | 'reviewing' | 'done' | 'failed';
export type ContainerStatus = 'stopped' | 'running' | 'paused' | 'removing';

// ============================================
// Agent Types
// ============================================

export interface Agent {
  id: string;
  projectId: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  sessionId?: string;
  containerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentEvent {
  type: 'status_change' | 'task_start' | 'task_complete' | 'task_fail' | 'approval_required' | 'log' | 'file_change' | 'token' | 'thinking' | 'tool_start' | 'tool_end';
  agentId: string;
  taskId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================
// Task Types
// ============================================

export interface Task {
  id: string;
  planId: string;
  type: TaskType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  branchName?: string;
  worktreePath?: string;
  assignedAgentId?: string;
  parentTaskId?: string;
  result?: TaskResult;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskResult {
  success: boolean;
  output?: string;
  filesModified?: string[];
  filesCreated?: string[];
  filesDeleted?: string[];
  error?: string;
  duration?: number;
}

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface TaskPlan {
  id: string;
  projectId: string;
  agentId?: string;
  goal: string;
  tasks: Task[];
  createdAt: Date;
}

// ============================================
// Project Types
// ============================================

export interface Project {
  id: string;
  userId: string;
  name: string;
  goal: string;
  status: ProjectStatus;
  workspacePath: string;
  mainBranch: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  goal: string;
  userId?: string; // Will use default user if not provided
}

// ============================================
// Container & Execution Types
// ============================================

export interface Container {
  id: string;
  projectId: string;
  name: string;
  image: string;
  status: ContainerStatus;
  worktreePath: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Execution {
  id: string;
  containerId: string;
  taskId?: string;
  type: 'build' | 'test' | 'lint' | 'execute' | 'install';
  status: ExecutionStatus;
  output?: string;
  exitCode?: number;
  command?: string;
  createdAt: Date;
  finishedAt?: Date;
}

export interface CreateExecutionRequest {
  containerId: string;
  taskId?: string;
  type: Execution['type'];
  command: string;
}

// ============================================
// Approval Types
// ============================================

export interface ApprovalRequest {
  id: string;
  agentId: string;
  taskId: string;
  action: string;
  description: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: Date;
}

export interface CreateApprovalRequest {
  agentId: string;
  taskId: string;
  action: string;
  description: string;
  payload?: Record<string, unknown>;
}

export interface ResolveApprovalRequest {
  action: 'approve' | 'reject';
  reason?: string;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateTaskRequest {
  type: Task['type'];
  title: string;
  description: string;
  priority?: TaskPriority;
  parentTaskId?: string;
  dependencies?: string[];
}

export interface CreatePlanRequest {
  goal: string;
  requirements?: string;
  agentId?: string;
}

export interface UpdateTaskRequest {
  status?: TaskStatus;
  assignedAgentId?: string;
  result?: TaskResult;
}

export interface UpdateAgentRequest {
  status?: AgentStatus;
  sessionId?: string;
}

export interface UpdateProjectRequest {
  status?: ProjectStatus;
}

// ============================================
// SSE Event Types
// ============================================

export interface SSEEvent {
  event: string;
  data: unknown;
}

export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatus;
  taskId?: string;
}

export interface TaskEvent {
  taskId: string;
  status: TaskStatus;
  result?: TaskResult;
}

export interface FileEvent {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  content?: string;
}

export interface ExecutionEvent {
  executionId: string;
  status: ExecutionStatus;
  output?: string;
  exitCode?: number;
}

export interface GitEvent {
  projectId: string;
  branch: string;
  action: 'created' | 'merged' | 'deleted' | 'status';
  files?: string[];
}

// ============================================
// Git Worktree Types
// ============================================

export interface WorktreeInfo {
  branch: string;
  path: string;
  isMain: boolean;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
}

export interface GitFileStatus {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '?' | '!';
  staged: boolean;
}

// ============================================
// Agent SDK Event Types (for Pi SDK)
// ============================================

export interface AgentTokenEvent {
  delta: string;
}

export interface AgentThinkingEvent {
  delta: string;
}

export interface ToolStartEvent {
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolEndEvent {
  tool: string;
  result: unknown;
  isError: boolean;
}

export interface AgentCompleteEvent {
  reason: string;
  messages: unknown[];
}

// ============================================
// Queue Job Types
// ============================================

export interface AgentJob {
  jobId: string;
  jobType: 'planning' | 'coding' | 'review' | 'testing' | 'debugging';
  projectId: string;
  agentId: string;
  taskId: string;
  prompt: string;
  context: {
    workspacePath: string;
    worktreePath?: string;
    branchName?: string;
    containerId?: string;
    existingFiles?: string[];
  };
  signal?: string; // Serialized AbortSignal ID
}

export interface ExecutionJob {
  jobId: string;
  containerId: string;
  taskId?: string;
  command: string;
  type: Execution['type'];
  timeout?: number;
}
