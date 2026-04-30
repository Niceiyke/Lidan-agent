# Agentic OS - Feature Roadmap

## Overview

This document outlines potential features and capabilities for Agentic OS, an AI-powered software factory that autonomously plans, builds, and tests applications.

## Implemented Features

### Core System
- [x] Hono API server with routes
- [x] Prisma + PostgreSQL database
- [x] BullMQ + Redis task queue
- [x] Git worktree management
- [x] Docker sandbox execution
- [x] Next.js web dashboard
- [x] Pi SDK agents (planner, coder, reviewer, tester)
- [x] SSE event streaming
- [x] File watching
- [x] Graceful shutdown
- [x] Health checks (K8s probes)
- [x] Worktree cleanup
- [x] Circuit breaker pattern

### Current Capabilities
- Create projects from natural language goals
- Automatic task planning and decomposition
- Git branch isolation per task
- Docker sandbox for code execution
- Real-time status updates via SSE
- Basic web dashboard with Tailwind CSS

---

## Proposed Features

### Priority: High 🔥

#### 1. Real-time Token Streaming
**Description:** Stream AI agent output tokens in real-time via SSE

```typescript
// Example API response
event: token
data: {"agent":"planner","token":"Planning your project..."}

event: token  
data: {"agent":"planner","token":"1. Setup project..."}

event: task_created
data: {"taskId":"...","title":"Setup project"}
```

**Benefits:**
- See agent thinking in real-time
- Better UX with streaming output
- Progress indicators

**Implementation:**
```typescript
// In agent-pool.ts
async streamPrompt(agentId: string, prompt: string) {
  const response = await this.client.prompt(prompt, {
    stream: true,
    onToken: (token) => {
      this.emit('token', { agentId, token });
    }
  });
}
```

**Routes needed:**
- `GET /api/agents/:id/stream` - SSE for agent output

---

#### 2. Project Templates
**Description:** Pre-built starter templates for common project types

**Templates:**
```typescript
const templates = {
  'react-app': {
    name: 'React App',
    description: 'Vite + React + TypeScript',
    files: ['package.json', 'src/App.tsx', 'vite.config.ts'],
    dependencies: ['react', 'react-dom', 'vite'],
  },
  'node-api': {
    name: 'Node.js API',
    description: 'Express + TypeScript',
    files: ['package.json', 'src/index.ts'],
    dependencies: ['express', 'typescript'],
  },
  'python-flask': {
    name: 'Python Flask API',
    description: 'Flask + SQLAlchemy',
    files: ['requirements.txt', 'app.py'],
    dependencies: ['flask', 'sqlalchemy'],
  },
  'fullstack-next': {
    name: 'Next.js Fullstack',
    description: 'Next.js + Prisma + Tailwind',
    files: ['package.json', 'app/page.tsx'],
    dependencies: ['next', 'prisma', 'tailwindcss'],
  }
};
```

**API:**
```bash
GET  /api/templates          # List all templates
GET  /api/templates/:id       # Get template details
POST /api/goals               # With optional template field
{
  "goal": "A blog app",
  "template": "fullstack-next"
}
```

---

#### 3. Container Execution Logs
**Description:** Stream Docker container logs to the UI

**API:**
```bash
GET /api/executions/:id/logs    # Stream logs via SSE

event: log
data: {"line":"$ npm install...","timestamp":"..."}

event: log
data: {"line":"added 234 packages","timestamp":"..."}
```

**Implementation:**
```typescript
// In container-manager.ts
async streamLogs(containerId: string): Promise<AsyncIterable<string>> {
  const stream = await docker.container.logs(containerId, {
    follow: true,
    stdout: true,
    stderr: true,
    timestamps: true,
  });
  return stream;
}
```

---

#### 4. Git Branch Management
**Description:** Visual branch management in the web UI

**API:**
```bash
GET  /api/projects/:id/branches        # List all branches
POST /api/projects/:id/branches         # Create branch
GET  /api/projects/:id/branches/:name  # Get branch details
POST /api/projects/:id/branches/:name/merge  # Merge branch
POST /api/projects/:id/branches/:name/pull   # Create PR

# Response
{
  "branches": [
    {
      "name": "main",
      "lastCommit": "abc123",
      "ahead": 0,
      "behind": 2,
      "worktreePath": "/tmp/agentic-workspaces/project-xxx"
    },
    {
      "name": "task/123",
      "lastCommit": "def456",
      "ahead": 3,
      "behind": 0,
      "files": ["src/index.ts", "package.json"]
    }
  ]
}
```

---

#### 5. Cost Tracking
**Description:** Track API costs per project and agent

**Database Schema:**
```prisma
model CostRecord {
  id          String   @id @default(uuid())
  projectId   String
  agentId     String?
  model       String   // claude-3, gpt-4, etc.
  inputTokens Int
  outputTokens Int
  cost        Float
  timestamp   DateTime @default(now())
  
  project     Project @relation(fields: [projectId], references: [id])
}
```

**API:**
```bash
GET /api/projects/:id/costs         # Get project costs
GET /api/stats/costs               # Get all-time costs

# Response
{
  "totalCost": 12.45,
  "breakdown": [
    { "model": "claude-3-opus", "cost": 8.50, "tokens": 125000 },
    { "model": "gpt-4", "cost": 3.95, "tokens": 45000 }
  ]
}
```

---

### Priority: Medium 🚀

#### 6. Webhook Notifications
**Description:** Send HTTP POST to URL on task/project events

**API:**
```bash
POST /api/projects/:id/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["task.completed", "task.failed", "project.done"],
  "secret": "your-webhook-secret"
}
```

**Webhook payload:**
```json
{
  "event": "task.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "taskId": "abc123",
    "projectId": "xyz789",
    "status": "done",
    "duration": 45000
  }
}
```

---

#### 7. Multi-Model Selection
**Description:** Choose AI model per project

**API:**
```bash
POST /api/projects
{
  "goal": "A web app",
  "model": "claude-3-opus"  // or "gpt-4", "gemini-pro"
}

# Available models
GET /api/models
{
  "models": [
    { "id": "claude-3-opus", "name": "Claude 3 Opus", "costPer1k": 0.015 },
    { "id": "claude-3-sonnet", "name": "Claude 3 Sonnet", "costPer1k": 0.003 },
    { "id": "gpt-4", "name": "GPT-4", "costPer1k": 0.03 },
    { "id": "gemini-pro", "name": "Gemini Pro", "costPer1k": 0.001 }
  ]
}
```

---

#### 8. File Diff Viewer
**Description:** Visual diff viewer for code changes

**API:**
```bash
GET /api/projects/:id/diff?branch=task/123

# Response
{
  "files": [
    {
      "path": "src/index.ts",
      "status": "modified",
      "additions": 15,
      "deletions": 3,
      "diff": "@@ -1,5 +1,7 @@\nexport function main() {\n+  console.log('hello');\n }"
    }
  ]
}
```

---

#### 9. Deploy Integration
**Description:** One-click deploy to hosting platforms

**Supported:**
- Vercel
- Netlify
- Railway
- Fly.io

**API:**
```bash
POST /api/projects/:id/deploy
{
  "platform": "vercel",
  "token": "xxxxx",
  "projectName": "my-app"
}

# Response
{
  "url": "https://my-app.vercel.app",
  "status": "deploying"
}
```

---

### Priority: Low 💡

#### 10. CLI Tool
**Description:** Command-line interface for Lidan

```bash
# Install
npm install -g @agentic-os/cli

# Usage
lidan create "A todo app with auth"     # Create project
lidan list                               # List projects
lidan logs <project-id>                  # View logs
lidan deploy <project-id> --vercel        # Deploy
lidan status <project-id>                # Check status
```

---

#### 11. GitHub Integration
**Description:** Auto-create PR on task completion

```bash
POST /api/projects/:id/integrations/github
{
  "token": "ghp_xxxxx",
  "repo": "user/repo"
}

# Auto-creates PR when task completes
```

---

#### 12. Scheduled Jobs
**Description:** Cron-like task scheduling

```bash
POST /api/projects/:id/schedule
{
  "cron": "0 9 * * *",  # Daily at 9 AM
  "task": "Run tests",
  "description": "Run full test suite every morning"
}
```

---

#### 13. Slack/Discord Alerts
**Description:** Send notifications to chat platforms

```bash
POST /api/projects/:id/alerts
{
  "type": "slack",
  "webhook": "https://hooks.slack.com/..."
}

# Message format
"Agentic OS: Task 'Plan: my-app' completed successfully in 2m 30s"
```

---

#### 14. Collaborative Editing
**Description:** Multiple users can work on same project

**Features:**
- Real-time cursor positions (Y.js)
- User presence indicators
- Comments on code
- @mentions

---

#### 15. Code Search
**Description:** Search across all project files

```bash
GET /api/projects/:id/search?q=auth&type=function

# Response
{
  "results": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "context": "export async function authenticateUser() {"
    }
  ]
}
```

---

## Feature Implementation Checklist

### Phase 1: Core UX Improvements ✅ COMPLETED
- [x] Real-time Token Streaming
- [x] Project Templates
- [x] Container Execution Logs

### Phase 2: Git ### Phase 2: Git & Deployment Deployment ✅ COMPLETED
- [x] Branch Management
- [x] File Diff Viewer
- [x] Deploy Integration

### Phase 3: Observability
- [ ] Cost Tracking
- [ ] Webhook Notifications
- [ ] Slack/Discord Alerts

### Phase 4: Collaboration
- [ ] CLI Tool
- [ ] GitHub Integration
- [ ] Scheduled Jobs

---

## Contributing

To propose a new feature:
1. Add to this document with description
2. Include API design (if applicable)
3. Estimate complexity (Low/Medium/High)
4. Add to appropriate priority section
