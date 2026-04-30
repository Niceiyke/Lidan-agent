# Agentic OS - Todo List

## Overview
AI-powered software factory that autonomously plans, builds, and tests applications using multi-agent orchestration.

## Project Status

### ✅ Completed
- [x] Project initialization with monorepo structure (pnpm workspaces)
- [x] Hono API server with routes for goals, tasks, projects, agents
- [x] Prisma schema with PostgreSQL for data persistence
- [x] BullMQ workers with Redis for task queue
- [x] Git worktree manager for branch isolation
- [x] Docker sandbox container management
- [x] Next.js web dashboard with Tailwind CSS
- [x] Pi SDK agent implementations (planner, coder, reviewer, tester)
- [x] SSE event streaming for real-time updates
- [x] File watcher for workspace synchronization
- [x] Initial database schema and migrations
- [x] Git repository initialization
- [x] Docker sandbox image built
- [x] API server running successfully
- [x] **Resilience module implemented**

### 🛡️ Resilience Features Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| Connection retry with backoff | ✅ | Exponential backoff for DB/Redis |
| Worktree cleanup | ✅ | Automatic cleanup of stale worktrees |
| Health checks | ✅ | `/health/detailed`, `/ready`, `/live` |
| Graceful shutdown | ✅ | SIGTERM/SIGINT handling |
| Circuit breaker | ✅ | For external service calls |
| Worker error handling | ✅ | Retry with backoff |
| Kubernetes probes | ✅ | Readiness & liveness endpoints |

### 🟡 Pending - Important

#### 1. Pi Agent Integration
Connect Pi SDK agents to the worker execution pipeline.

- [x] Configure Pi provider (Anthropic/OpenAI)
- [x] Test planner agent with goal
- [ ] Test coder agent generates code
- [ ] Test reviewer agent validates output
- [ ] Test tester agent runs tests

#### 2. Approval Flow
Implement human-in-the-loop for critical actions.

- [ ] Code changes require approval before merge
- [ ] Destructive operations need confirmation
- [ ] Approval queue UI in dashboard

### 🟢 Pending - Nice to Have

#### 3. Production Build
Prepare for production deployment.

- [ ] Build API for production (`pnpm build:api`)
- [ ] Build Web for production (`pnpm build:web`)
- [ ] Docker Compose for full stack
- [ ] Environment variable validation

#### 4. Monitoring & Observability
Add metrics and logging.

- [ ] Prometheus metrics endpoint
- [ ] Structured logging (JSON)
- [ ] Performance profiling

## Quick Start Commands

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Start API
cd apps/api
export DATABASE_URL="postgresql://agentic:agentic_dev@localhost:5432/agentic_os"
export REDIS_URL="redis://localhost:6379"
export WORKSPACES_PATH="/tmp/agentic-workspaces"
export ANTHROPIC_API_KEY="your-key"
export PORT=5555
npx tsx src/index.ts

# Health checks
curl http://localhost:5555/health          # Basic
curl http://localhost:5555/health/detailed # With dependencies
curl http://localhost:5555/ready          # Kubernetes readiness
curl http://localhost:5555/live           # Kubernetes liveness

# Cleanup stale worktrees
curl -X POST http://localhost:5555/api/admin/cleanup?hours=48

# Create a project
curl -X POST http://localhost:5555/api/goals \
  -H "Content-Type: application/json" \
  -d '{"goal":"A simple hello world app"}'
```

## Health Check Endpoints

| Endpoint | Purpose | Returns |
|----------|---------|---------|
| `/health` | Basic health | Status, workers, queue |
| `/health/detailed` | Full diagnostics | DB, Redis, Docker, worktrees |
| `/ready` | K8s readiness | Ready if DB + Redis connected |
| `/live` | K8s liveness | Always true if running |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Web UI (Next.js)                     │
│              http://localhost:4222                       │
└─────────────────────┬───────────────────────────────────┘
                      │ Proxy (/api/*)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server (Hono)                     │
│                   Port: 5555                             │
├─────────────────────────────────────────────────────────┤
│  🛡️ Resilience: Retry, Circuit Breaker, Cleanup         │
│  Routes: goals, tasks, projects, agents, approvals       │
│  SSE: /events/stream                                    │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  BullMQ Queue   │     │   PostgreSQL    │
│  (Redis)         │     │   Database     │
│  ⚡ Retry+Backoff│     │   🔄 Reconnect │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Worker Pool                            │
├─────────────────────────────────────────────────────────┤
│  🧹 Worktree Cleanup | ⚡ Retry | 🔄 Circuit Breaker    │
│  Planner Agent → Coder Agent → Review Agent → Tester   │
│         │              │              │              │    │
│         └──────────────┴──────────────┴──────────────┘  │
│                            │                             │
│                            ▼                             │
│                   ┌─────────────────┐                   │
│                   │ Docker Sandbox   │                   │
│                   │   (Container)   │                   │
│                   └─────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Dependencies

| Service | Version | Purpose |
|---------|---------|---------|
| Node.js | 20+ | Runtime |
| pnpm | 8+ | Package manager |
| PostgreSQL | 15+ | Database |
| Redis | 7+ | Task queue |
| Docker | 24+ | Sandbox execution |
| Prisma | 5.22 | ORM |
| Hono | 4.x | API framework |
| Next.js | 14.x | Web frontend |
| Tailwind | 3.x | CSS framework |
| BullMQ | 5.x | Task queue |
| Pi SDK | 0.70+ | AI agents |

## License

MIT
