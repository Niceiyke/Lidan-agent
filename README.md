# Agentic OS

**An AI-Powered Software Factory** — A UI-controlled multi-agent system for autonomously building applications.

> Describe an app in plain English, and a team of AI agents plans, codes, tests, and reviews it while you supervise from a dashboard.

## 🎯 What Is This?

Agentic OS transforms natural language descriptions into fully functional applications using a team of AI agents:

1. **You** describe what you want to build
2. **Planner Agent** breaks it into tasks
3. **Coder Agents** implement features in parallel (one per task)
4. **Reviewer Agent** checks code quality
5. **Tester Agent** validates functionality
6. **Debugger Agent** fixes any issues
7. **You** supervise and approve risky operations

```
┌──────────────────────────────────────────────────────────────┐
│                        Dashboard                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Projects   │  │    Tasks    │  │  Terminal   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  AI Agent Team (Pi SDK)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Planner  │  │  Coder   │  │ Reviewer │  │ Tester   │     │
│  │ (1 max) │  │ (4 max)  │  │ (2 max)  │  │ (2 max)  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                 Docker Sandbox Environment                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Container 1 │  │ Container 2 │  │ Container 3 │          │
│  │ (worktree)  │  │ (worktree)  │  │ (worktree)  │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Natural Language Input** | Describe apps in plain English |
| **Multi-Agent Parallelism** | Multiple agents work simultaneously |
| **Git Worktrees** | Each task gets isolated branch |
| **Docker Sandboxing** | Safe code execution |
| **Real-time Dashboard** | Live progress monitoring |
| **Human-in-the-Loop** | Approve risky operations |
| **Live File Watching** | See changes as they happen |
| **Diff Viewer** | Review changes before merging |
| **Pi SDK Integration** | Powered by pi coding agent |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [Pi CLI](https://pi.dev) (`curl -fsSL https://pi.dev/install.sh | bash`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/agentic-os.git
cd agentic-os

# Install dependencies
npm install

# Start infrastructure
cp .env.example .env
docker-compose up -d postgres redis

# Setup database
npm run db:generate
npm run db:push

# Build sandbox image (for code execution)
npm run build:sandbox

# Start development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Authentication

Set your AI provider API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
```

Or use Pi's login command:
```bash
pi /login
```

---

## 📖 How to Use

### 1. Create a Project

Navigate to the dashboard and describe your app:

```
"A todo app with user authentication, React frontend, Node.js backend"
```

The system will:
1. Create a project workspace
2. Initialize a git repository
3. Start the planner agent to decompose the goal

### 2. Monitor Progress

Watch the dashboard for real-time updates:

| View | What You'll See |
|------|----------------|
| **Dashboard** | Goal input, agent status, task graph |
| **Projects** | All projects in a grid |
| **Tasks** | Filterable task list with status |
| **Approvals** | Pending approval requests |
| **Activity** | Real-time event log |

### 3. Task Workflow

Each task runs in its own:
- **Git Worktree** branch (e.g., `task/a1b2c3d`)
- **Docker Container** for isolated execution

Agents execute tasks in parallel:
```
Task 1 (coding) ──┬──▶ Branch `task/abc` ──▶ Merge to main
Task 2 (coding) ──┤
Task 3 (testing) ─┤
Task 4 (review)  ──┴──▶ Review feedback loop
```

### 4. Review Changes

When a coding task completes:
1. Click the task to see details
2. View the diff in unified or split mode
3. Merge to main when satisfied

### 5. Approve Risky Operations

Agents request approval for dangerous operations:

| Operation | Requires Approval |
|-----------|------------------|
| `rm -rf` | ✅ Always |
| Database drops | ✅ Always |
| Force push | ✅ Always |
| Sudo commands | ✅ Always |

You'll see a modal with:
- Operation description
- Payload details
- Approve/Reject buttons

---

## 🏗️ Architecture

```
agentic-os/
├── apps/
│   ├── api/                    # Hono backend
│   │   └── src/
│   │       ├── agents/          # Pi SDK agent implementations
│   │       │   ├── base-agent.ts
│   │       │   └── agent-pool.ts
│   │       ├── git/            # Git worktree operations
│   │       │   └── worktree-manager.ts
│   │       ├── sandbox/        # Docker container management
│   │       │   └── container-manager.ts
│   │       ├── storage/        # File watching
│   │       │   └── file-watcher.ts
│   │       ├── routes/        # API endpoints
│   │       └── orchestrator.ts # Task coordination
│   │
│   └── web/                   # Next.js frontend
│       └── src/
│           ├── components/     # UI components
│           │   ├── ProjectWorkspace.tsx
│           │   ├── DiffViewer.tsx
│           │   └── ApprovalQueue.tsx
│           └── app/
│               └── page.tsx    # Main dashboard
│
├── packages/
│   ├── types/                 # Shared TypeScript types
│   ├── pi-extensions/         # Pi agent extensions
│   │   ├── sandbox-tools.ts   # Safe container tools
│   │   └── approval-gate.ts   # Human approval
│   └── pi-skills/             # Agent skills
│       ├── planner-skill/
│       ├── coder-skill/
│       └── tester-skill/
│
├── Dockerfile.sandbox          # Agent execution image
├── docker-compose.yml          # Infrastructure
└── prisma/
    └── schema.prisma           # Database schema
```

### Component Responsibilities

| Component | Purpose |
|-----------|---------|
| **Orchestrator** | Coordinates agents, manages project lifecycle |
| **AgentPool** | Manages agent instances per role |
| **BaseAgent** | Pi SDK wrapper with event forwarding |
| **WorktreeManager** | Git worktree CRUD operations |
| **ContainerManager** | Docker container lifecycle |
| **FileWatcher** | Real-time file system watching |
| **SSEBroadcaster** | Real-time event streaming |

---

## 🔌 API Reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project details |
| GET | `/api/projects` | List all projects |
| PATCH | `/api/projects/:id` | Update status |
| DELETE | `/api/projects/:id` | Delete project |

### Goals

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/goals` | Create project from goal |
| GET | `/api/goals/:planId` | Get plan + tasks |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task details |
| PATCH | `/api/tasks/:id` | Update status |
| POST | `/api/tasks/:id/queue` | Queue for execution |
| POST | `/api/tasks/:id/cancel` | Cancel task |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agents` | Create agent |
| GET | `/api/agents` | List agents |
| PATCH | `/api/agents/:id` | Update agent status |

### Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/tree/:projectId` | Get file tree |
| GET | `/api/files/content?path=` | Read file |
| PUT | `/api/files/content` | Write file |
| GET | `/api/files/diff/:projectId` | Get git diff |
| POST | `/api/files/watch/:projectId` | Start watching |
| DELETE | `/api/files/watch/:projectId` | Stop watching |

### Executions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/executions` | Run command in container |
| GET | `/api/executions/:id` | Get execution status |
| GET | `/api/executions/:id/output` | Get output log |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/queue/stats` | Queue statistics |
| POST | `/api/admin/queue/pause` | Pause queue |
| POST | `/api/admin/queue/resume` | Resume queue |

---

## 🌐 Real-time Events (SSE)

Connect to `/events/stream`:

```javascript
const es = new EventSource('/events/stream');

es.addEventListener('project:created', (e) => { /* ... */ });
es.addEventListener('task:created', (e) => { /* ... */ });
es.addEventListener('task:queued', (e) => { /* ... */ });
es.addEventListener('task:running', (e) => { /* ... */ });
es.addEventListener('task:done', (e) => { /* ... */ });
es.addEventListener('task:failed', (e) => { /* ... */ });
es.addEventListener('agent:token', (e) => { /* streaming tokens */ });
es.addEventListener('agent:tool_start', (e) => { /* tool execution */ });
es.addEventListener('file:event', (e) => { /* file changes */ });
es.addEventListener('approval:requested', (e) => { /* pending approval */ });
```

---

## 🎨 UI Views

### Dashboard
Main view with goal input, agent dashboard, and task graph.

### Project Workspace
Per-project view with:
- **Files** - Expandable file tree
- **Git** - Branch status, changed files, worktrees
- **Terminal** - Command execution output
- **Tasks** - Project task list

### Approval Modal
Appears for dangerous operations with:
- Operation description
- Payload details (expandable)
- Approve/Reject buttons with reason input

### Diff Viewer
Code change viewer with:
- Unified/Split view toggle
- Line numbers
- Syntax highlighting
- Addition/deletion stats

---

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agentic_os

# Redis
REDIS_URL=redis://localhost:6379

# Ports
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Workspaces
WORKSPACES_PATH=/path/to/workspaces

# Agent Limits
MAX_CONCURRENT_TASKS=5
EXECUTION_TIMEOUT=300
```

### Agent Configuration

Edit agent behavior in `apps/api/src/agents/base-agent.ts`:

```typescript
const maxAgentsPerRole: Map<AgentRole, number> = new Map([
  ['planner', 1],    // One planner at a time
  ['coder', 4],      // Up to 4 coders
  ['reviewer', 2],    // Up to 2 reviewers
  ['tester', 2],      // Up to 2 testers
  ['debugger', 1],    // One debugger
]);
```

---

## ⚠️ What to Expect

### Expected Behavior

| Aspect | What to Expect |
|--------|----------------|
| **Planning** | ~10-30 seconds for goal decomposition |
| **Coding** | ~30s-5min per task (depends on complexity) |
| **Testing** | ~15s-2min per test suite |
| **Parallelism** | Up to 4 coding tasks simultaneously |
| **File Watching** | 100ms debounce on changes |
| **Container Startup** | ~5-10 seconds on first use |

### Current Limitations

| Limitation | Description |
|------------|-------------|
| **No Code Persistence** | Generated code lives in worktrees until merged |
| **Single User** | No multi-user auth (MVP stage) |
| **Manual Merging** | Worktree branches need manual merge review |
| **Container Dependency** | Requires Docker for execution |
| **Pi Installation Required** | Users need Pi CLI for agents to work |

### What's Working

✅ Real-time SSE streaming  
✅ Project creation from natural language  
✅ Task decomposition (planner agent)  
✅ Parallel task execution  
✅ Git worktree per task  
✅ Docker sandbox execution  
✅ File tree and watching  
✅ Diff viewing  
✅ Approval workflow  
✅ Terminal output streaming  

### What's Not Ready

🔧 Persistent memory (LanceDB)  
🔧 Git auto-commit/merge workflows  
🔧 File editor with save  
🔧 Multi-user authentication  
🔧 Team collaboration  
🔧 Plugin system  

---

## 🛡️ Security

### Sandbox Protection

All agent code executes in Docker containers:
- No host file system access (except `/workspace`)
- No network access to host
- Resource limits (CPU, memory)
- Timeout on long-running commands

### Approval Gates

Operations requiring approval:
- Recursive deletes (`rm -rf`)
- Database modifications (`DROP`, `ALTER`)
- Git force pushes
- System modifications

### What's Blocked

```bash
# These are blocked in sandbox
rm -rf /           # Blocked
curl ... | sh      # Blocked
mkfs              # Blocked
dd if=            # Blocked
sudo rm           # Blocked
```

---

## 🐛 Troubleshooting

### "Workers not starting"

```bash
# Check Redis is running
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### "Container not available"

```bash
# Rebuild sandbox image
npm run build:sandbox

# Check Docker is running
docker ps
```

### "Tasks stuck in queue"

```bash
# Check queue stats
curl http://localhost:3001/api/admin/queue/stats

# Pause and resume queue
curl -X POST http://localhost:3001/api/admin/queue/pause
curl -X POST http://localhost:3001/api/admin/queue/resume
```

### "File tree empty"

```bash
# Check file watcher
curl http://localhost:3001/api/files/tree/{projectId}

# Start watching
curl -X POST http://localhost:3001/api/files/watch/{projectId}
```

---

## 📝 License

MIT
