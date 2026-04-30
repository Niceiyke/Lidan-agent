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

### 🔴 Pending - Critical

#### 1. Docker Sandbox Image
Build the Docker sandbox image required for task execution.

```bash
cd agentic-os && docker build -f Dockerfile.sandbox -t agentic-os/sandbox:latest .
```

**Why:** Workers need the sandbox to execute code in isolated containers.

#### 2. AI API Configuration
Add valid AI provider API keys.

```bash
# Edit .env
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Required for Claude
OPENAI_API_KEY=sk-your-key-here          # Alternative for GPT-4
```

**Why:** Agents need AI to plan, code, review, and test.

#### 3. Worker Task Execution
Verify workers process tasks end-to-end.

- [ ] Create project via API/UI
- [ ] Verify planning task executes
- [ ] Verify coding tasks spawn
- [ ] Verify review/test flow works

### 🟡 Pending - Important

#### 4. Pi Agent Integration
Connect Pi SDK agents to the worker execution pipeline.

- [ ] Configure Pi provider (Anthropic/OpenAI)
- [ ] Test planner agent with goal
- [ ] Test coder agent generates code
- [ ] Test reviewer agent validates output
- [ ] Test tester agent runs tests

#### 5. Approval Flow
Implement human-in-the-loop for critical actions.

- [ ] Code changes require approval before merge
- [ ] Destructive operations need confirmation
- [ ] Approval queue UI in dashboard

#### 6. Error Handling
Improve error handling and recovery.

- [ ] Retry failed tasks automatically
- [ ] Dead letter queue for stuck jobs
- [ ] Graceful worker shutdown
- [ ] Container cleanup on failure

### 🟢 Pending - Nice to Have

#### 7. Production Build
Prepare for production deployment.

- [ ] Build API for production (`pnpm build:api`)
- [ ] Build Web for production (`pnpm build:web`)
- [ ] Docker Compose for full stack
- [ ] Environment variable validation

#### 8. Testing
Add automated tests.

- [ ] Unit tests for agents
- [ ] Integration tests for API
- [ ] E2E tests for web UI
- [ ] Worker load testing

#### 9. Monitoring & Observability
Add metrics and logging.

- [ ] Prometheus metrics endpoint
- [ ] Structured logging (JSON)
- [ ] Health check improvements
- [ ] Performance profiling

#### 10. Documentation
Complete documentation.

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Deployment guide
- [ ] Agent architecture docs
- [ ] Contributing guide

## Quick Start Commands

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Start API
cd apps/api
export DATABASE_URL="postgresql://agentic:agentic_dev@localhost:5432/agentic_os"
export REDIS_URL="redis://localhost:6379"
export WORKSPACES_PATH="/tmp/agentic-workspaces"
npx tsx src/index.ts

# Start Web (in another terminal)
cd apps/web
node node_modules/next/dist/bin/next dev -p 3222

# Create a project
curl -X POST http://localhost:3001/api/goals \
  -H "Content-Type: application/json" \
  -d '{"goal":"A simple hello world app"}'
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Web UI (Next.js)                     │
│              http://localhost:3222                        │
└─────────────────────┬───────────────────────────────────┘
                      │ Proxy (/api/*)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   API Server (Hono)                     │
│                   Port: 3001                             │
├─────────────────────────────────────────────────────────┤
│  Routes: goals, tasks, projects, agents, approvals     │
│  SSE: /events/stream                                    │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  BullMQ Queue   │     │   PostgreSQL    │
│  (Redis)         │     │   Database     │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Worker Pool                          │
├─────────────────────────────────────────────────────────┤
│  Planner Agent → Coder Agent → Review Agent → Tester  │
│         │              │              │              │    │
│         └──────────────┴──────────────┴──────────────┘  │
│                            │                             │
│                            ▼                             │
│                   ┌─────────────────┐                   │
│                   │ Docker Sandbox  │                   │
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

## File Structure

```
agentic-os/
├── apps/
│   ├── api/              # Backend API
│   │   ├── src/
│   │   │   ├── agents/   # AI agents
│   │   │   ├── git/      # Git operations
│   │   │   ├── routes/   # API routes
│   │   │   ├── sandbox/  # Container management
│   │   │   ├── storage/  # File management
│   │   │   ├── index.ts  # Entry point
│   │   │   ├── orchestrator.ts
│   │   │   ├── queue.ts  # BullMQ setup
│   │   │   └── worker.ts # Task workers
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/              # Frontend
│       └── src/
│           ├── app/      # Next.js pages
│           └── components/
├── packages/
│   ├── types/            # Shared types
│   ├── pi-extensions/    # Pi SDK extensions
│   ├── pi-skills/        # Agent skills
│   └── pi-wrapper/       # Pi wrapper
├── docs/                 # Documentation
├── Dockerfile.sandbox    # Sandbox image
├── docker-compose.yml    # Infrastructure
└── pnpm-workspace.yaml
```

## License

MIT
