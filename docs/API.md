# API Documentation

Complete reference for the Agentic OS REST API.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently, no authentication is required (MVP stage). In production, add:
- `Authorization: Bearer <token>` header

---

## Projects

### Create Project

```http
POST /api/projects
```

**Request Body:**
```json
{
  "name": "my-app",
  "goal": "A todo app with React and Node.js",
  "userId": "optional-user-id"
}
```

**Response:**
```json
{
  "projectId": "uuid",
  "name": "my-app",
  "status": "planning",
  "workspacePath": "/path/to/workspace"
}
```

---

### Get Project

```http
GET /api/projects/:projectId
```

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "name": "my-app",
    "goal": "A todo app with React and Node.js",
    "status": "building",
    "workspacePath": "/path/to/workspace",
    "mainBranch": "main",
    "plans": [...],
    "agents": [...],
    "containers": [...]
  },
  "gitStatus": {
    "branch": "main",
    "ahead": 0,
    "behind": 0,
    "files": []
  }
}
```

---

### List Projects

```http
GET /api/projects
```

**Query Parameters:**
- `userId` - Filter by user
- `status` - Filter by status (`planning`, `building`, `reviewing`, `done`, `failed`)

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "my-app",
      "goal": "...",
      "status": "building",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### Update Project

```http
PATCH /api/projects/:projectId
```

**Request Body:**
```json
{
  "status": "done"
}
```

---

### Delete Project

```http
DELETE /api/projects/:projectId
```

---

## Goals

### Create Goal

Creates a new project with initial planning task.

```http
POST /api/goals
```

**Request Body:**
```json
{
  "goal": "A REST API with Express and PostgreSQL",
  "requirements": "Optional additional requirements"
}
```

**Response:**
```json
{
  "projectId": "uuid",
  "planId": "uuid",
  "taskId": "uuid",
  "workspacePath": "/path/to/workspace"
}
```

---

### Get Goal/Plan

```http
GET /api/goals/:planId
```

**Response:**
```json
{
  "plan": {
    "id": "uuid",
    "goal": "A REST API with Express",
    "tasks": [
      {
        "id": "uuid",
        "type": "planning",
        "title": "Plan: A REST API",
        "status": "done",
        "children": [...]
      }
    ]
  }
}
```

---

## Tasks

### Create Task

```http
POST /api/tasks
```

**Request Body:**
```json
{
  "planId": "uuid",
  "type": "coding",
  "title": "Implement user authentication",
  "description": "Create login, register, and session management",
  "priority": "high",
  "parentTaskId": "optional-parent-uuid",
  "dependencies": ["uuid-1", "uuid-2"]
}
```

---

### Get Task

```http
GET /api/tasks/:taskId
```

**Response:**
```json
{
  "task": {
    "id": "uuid",
    "type": "coding",
    "title": "Implement user authentication",
    "description": "...",
    "status": "done",
    "priority": "high",
    "branchName": "task/a1b2c3d",
    "worktreePath": "/path/to/worktree",
    "result": {
      "success": true,
      "output": "Completed",
      "filesCreated": ["src/auth/login.ts"]
    },
    "assignedAgent": {...},
    "dependencies": [...],
    "executions": [...]
  }
}
```

---

### List Tasks

```http
GET /api/tasks
```

**Query Parameters:**
- `planId` - Filter by plan
- `projectId` - Filter by project
- `status` - Filter by status
- `type` - Filter by type
- `assignedAgentId` - Filter by assigned agent

---

### Update Task

```http
PATCH /api/tasks/:taskId
```

**Request Body:**
```json
{
  "status": "running",
  "assignedAgentId": "uuid"
}
```

---

### Queue Task

Queues a pending task for execution.

```http
POST /api/tasks/:taskId/queue
```

**Response:**
```json
{
  "success": true,
  "jobId": "bullmq-job-id"
}
```

---

### Cancel Task

```http
POST /api/tasks/:taskId/cancel
```

---

## Agents

### Create Agent

```http
POST /api/agents
```

**Request Body:**
```json
{
  "projectId": "uuid",
  "name": "coder-1",
  "role": "coder"
}
```

---

### List Agents

```http
GET /api/agents
```

**Query Parameters:**
- `projectId` - Filter by project
- `role` - Filter by role
- `status` - Filter by status

---

### Get Agent Logs

```http
GET /api/agents/:agentId/logs
```

**Query Parameters:**
- `level` - Filter by level (`debug`, `info`, `warn`, `error`)
- `limit` - Number of logs to return (default: 100)

---

## Files

### Get File Tree

```http
GET /api/files/tree/:projectId
```

**Query Parameters:**
- `depth` - Max depth (default: 3)

**Response:**
```json
{
  "files": [
    {
      "name": "src",
      "type": "directory",
      "path": "/workspace/src",
      "children": [
        { "name": "index.ts", "type": "file", "path": "/workspace/src/index.ts" }
      ]
    }
  ],
  "workspacePath": "/path/to/workspace"
}
```

---

### Get File Content

```http
GET /api/files/content?path=/workspace/src/index.ts
```

**Response:**
```json
{
  "path": "/workspace/src/index.ts",
  "content": "console.log('hello');",
  "language": "typescript"
}
```

---

### Write File Content

```http
PUT /api/files/content
```

**Request Body:**
```json
{
  "path": "/workspace/src/index.ts",
  "content": "console.log('hello');"
}
```

---

### Get Diff

```http
GET /api/files/diff/:projectId
```

**Query Parameters:**
- `taskId` - Get diff for specific task's worktree
- `file` - Get diff for specific file

**Response:**
```json
{
  "diff": "--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,4 @@\n+console.log('hello');",
  "worktreePath": "/path/to/worktree",
  "projectPath": "/path/to/project"
}
```

---

### Get Changed Files

```http
GET /api/files/changes/:projectId
```

**Response:**
```json
{
  "files": [
    { "path": "src/index.ts", "status": "M", "staged": true }
  ],
  "branch": "task/a1b2c3d"
}
```

---

## Executions

### Create Execution

Runs a command in a project's container.

```http
POST /api/executions
```

**Request Body:**
```json
{
  "containerId": "uuid",
  "taskId": "optional-task-uuid",
  "type": "test",
  "command": "npm test",
  "timeout": 60
}
```

---

### Get Execution

```http
GET /api/executions/:executionId
```

---

### Get Execution Output

```http
GET /api/executions/:executionId/output
```

**Response:**
```json
{
  "executionId": "uuid",
  "output": "Test output here...",
  "status": "success",
  "exitCode": 0
}
```

---

## Approvals

### Create Approval Request

```http
POST /api/approvals
```

**Request Body:**
```json
{
  "agentId": "uuid",
  "taskId": "uuid",
  "action": "delete_files",
  "description": "Recursive delete of node_modules",
  "payload": { "command": "rm -rf node_modules" }
}
```

---

### List Approvals

```http
GET /api/approvals
```

**Query Parameters:**
- `agentId` - Filter by agent
- `status` - Filter by status (`pending`, `approved`, `rejected`)

---

### Resolve Approval

```http
PATCH /api/approvals/:approvalId
```

**Request Body:**
```json
{
  "action": "approve",
  "reason": "Optional reason"
}
```

---

## Admin

### Queue Stats

```http
GET /api/admin/queue/stats
```

**Response:**
```json
{
  "tasks": {
    "waiting": 5,
    "active": 2,
    "completed": 100,
    "failed": 3,
    "delayed": 1
  },
  "executions": {
    "waiting": 0,
    "active": 1,
    "completed": 50,
    "failed": 1,
    "delayed": 0
  }
}
```

---

### Pause Queue

```http
POST /api/admin/queue/pause
```

---

### Resume Queue

```http
POST /api/admin/queue/resume
```

---

## Health

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "0.2.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "workers": {
    "taskWorker": { "waiting": 0, "active": 1, "completed": 10, "failed": 0 },
    "executionWorker": { "waiting": 0, "active": 0, "completed": 5, "failed": 0 }
  },
  "queue": { "waiting": 0, "active": 1, "completed": 10, "failed": 0 }
}
```

---

## SSE Events

Connect to `http://localhost:3001/events/stream` for real-time events.

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | - | Connection established |
| `project:created` | `{projectId, name}` | New project created |
| `project:status` | `{projectId, status}` | Project status changed |
| `project:deleted` | `{projectId}` | Project deleted |
| `task:created` | `{taskId, projectId, type}` | New task created |
| `task:queued` | `{taskId}` | Task added to queue |
| `task:running` | `{taskId, type, priority}` | Task execution started |
| `task:done` | `{taskId, result}` | Task completed successfully |
| `task:failed` | `{taskId, error}` | Task failed |
| `task:blocked` | `{taskId, reason}` | Task blocked by dependencies |
| `agent:created` | `{id, name, role}` | Agent created |
| `agent:updated` | `{agentId, status}` | Agent status changed |
| `agent:token` | `{agentId, delta}` | Streaming token output |
| `agent:tool_start` | `{agentId, tool, input}` | Tool execution started |
| `agent:tool_end` | `{agentId, tool, result, isError}` | Tool execution completed |
| `container:created` | `{projectId, containerId, containerName}` | Container started |
| `worktree:created` | `{taskId, branch, path}` | Worktree created |
| `file:event` | `{path, action}` | File changed |
| `execution:started` | `{executionId, containerId, type}` | Execution started |
| `execution:completed` | `{executionId, exitCode}` | Execution completed |
| `approval:requested` | `{id, agentId, action}` | Approval required |
| `approval:resolved` | `{id, status}` | Approval resolved |

---

## Error Responses

All errors return a JSON object:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error
