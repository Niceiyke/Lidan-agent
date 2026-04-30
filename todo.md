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
- [x] Fixed worktree creation (exec output handling)
- [x] Fixed agent pool (name property)
- [x] Fixed orchestrator (projectId reference)
- [x] API server running successfully on port 5555

### 🔴 Pending - Critical
None - all critical issues resolved!

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

#### 3. Error Handling
Improve error handling and recovery.

- [x] Retry failed tasks automatically
- [x] Worktree cleanup on failure
- [ ] Graceful worker shutdown
- [ ] Container cleanup on failure

### 🟢 Pending - Nice to Have

#### 4. Production Build
Prepare for production deployment.

- [ ] Build API for production (`pnpm build:api`)
- [ ] Build Web for production (`pnpm build:web`)
- [ ] Docker Compose for full stack
- [ ] Environment variable validation

#### 5. Testing
Add automated tests.

- [ ] Unit tests for agents
- [ ] Integration tests for API
- [ ] E2E tests for web UI
- [ ] Worker load testing

#### 6. Monitoring & Observability
Add metrics and logging.

- [ ] Prometheus metrics endpoint
- [ ] Structured logging (JSON)
- [ ] Health check improvements
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

# Start Web (in another terminal)
cd apps/web
node node_modules/next/dist/bin/next dev -p 4222

# Create a project
curl -X POST http://localhost:5555/api/goals \
  -H "Content-Type: application/json" \
  -d '{"goal":"A simple hello world app"}'
```

## Architecture Diagram

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
│  Routes: goals, tasks, projects, agents, approvals       │
│  SSE: /events/stream                                    │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  BullMQ Queue    │     │   PostgreSQL     │
│  (Redis)         │     │   Database       │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Worker Pool                           │
├─────────────────────────────────────────────────────────┤
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
