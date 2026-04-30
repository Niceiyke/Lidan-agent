# Contributing to Agentic OS

Thank you for your interest in contributing!

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)

---

## Development Setup

### Prerequisites

- Node.js 20+
- Docker + Docker Compose
- [Pi CLI](https://pi.dev) for agent testing

### Initial Setup

```bash
# Clone and install
git clone https://github.com/your-org/agentic-os.git
cd agentic-os
npm install

# Copy environment
cp .env.example .env

# Start infrastructure
docker-compose up -d postgres redis

# Setup database
npm run db:generate
npm run db:push

# Build sandbox image
npm run build:sandbox
```

### Running Locally

```bash
# API only
npm run dev:api

# Web only
npm run dev:web

# Both
npm run dev
```

### Verifying Setup

```bash
# Check health endpoint
curl http://localhost:3001/health

# Should return
{
  "status": "ok",
  "version": "0.2.0",
  "workers": { ... },
  "queue": { ... }
}
```

---

## Project Structure

```
agentic-os/
├── apps/
│   ├── api/                    # Hono backend
│   │   ├── prisma/            # Database schema
│   │   └── src/
│   │       ├── agents/        # Pi SDK agents
│   │       ├── git/           # Git operations
│   │       ├── sandbox/       # Docker containers
│   │       ├── storage/       # File watching
│   │       ├── routes/        # API endpoints
│   │       ├── orchestrator.ts
│   │       ├── queue.ts       # BullMQ setup
│   │       ├── worker.ts      # Job processor
│   │       └── sse.ts         # Real-time events
│   │
│   └── web/                   # Next.js frontend
│       └── src/
│           ├── components/    # React components
│           └── app/           # App router
│
├── packages/
│   ├── types/                 # Shared types
│   ├── pi-extensions/         # Pi extensions
│   └── pi-skills/             # Agent skills
│
├── Dockerfile.sandbox         # Agent execution image
└── docker-compose.yml
```

---

## Making Changes

### Adding a New Agent Role

1. **Define the agent** in `apps/api/src/agents/base-agent.ts`:

```typescript
export class NewAgent extends BaseAgent {
  static async create(config: AgentConfig): Promise<NewAgent> {
    const agent = new NewAgent(config);
    await agent.initialize();
    return agent;
  }

  getTools(): any[] {
    return [readTool, bashTool];
  }

  getSystemPrompt(): string {
    return `You are a...`;
  }

  getRoleStatus(): AgentStatus {
    return 'new_role';
  }

  async doSomething(): Promise<TaskResult> {
    // Implementation
  }
}
```

2. **Register in factory** in `createAgent()`:

```typescript
export async function createAgent(role, config) {
  switch (role) {
    case 'new_role':
      return NewAgent.create(config);
    // ...
  }
}
```

3. **Add to agent pool limits** in `agent-pool.ts`:

```typescript
private maxAgentsPerRole: Map<AgentRole, number> = new Map([
  // ...
  ['new_role', 2],
]);
```

4. **Add task handler** in `worker.ts`:

```typescript
case 'new_role':
  result = await executeNewRoleTask(taskId, project, job);
  break;
```

### Adding a New API Route

1. **Create route file** in `apps/api/src/routes/`:

```typescript
// new-route.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const newRoute = new Hono();

const schema = z.object({
  field: z.string(),
});

newRoute.post('/', zValidator('json', schema), async (c) => {
  const prisma = c.get('prisma');
  const sse = c.get('sse');
  const data = c.req.valid();
  
  // Handle request
  
  return c.json({ success: true });
});

export default newRoute;
```

2. **Register in index.ts**:

```typescript
import newRouteRouter from './routes/new-route.js';

// In app setup:
app.route('/api/new', newRouteRouter);
```

### Adding a New Database Model

1. **Update schema** in `apps/api/prisma/schema.prisma`:

```prisma
model NewModel {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  related   RelatedModel? @relation(...)
}
```

2. **Generate client**:

```bash
npm run db:generate
```

3. **Use in code**:

```typescript
const model = await prisma.newModel.create({
  data: { name: 'test' },
});
```

### Adding a New SSE Event

1. **Emit event** in API:

```typescript
sse.broadcast('new:event', { data: 'payload' });
```

2. **Handle in frontend**:

```typescript
eventSource.addEventListener('new:event', (e) => {
  const data = JSON.parse(e.data);
  // Handle event
});
```

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Specific package
npm test --workspace=apps/api

# Watch mode
npm test -- --watch
```

### Manual Testing

```bash
# Create a test goal
curl -X POST http://localhost:3001/api/goals \
  -H "Content-Type: application/json" \
  -d '{"goal": "A simple hello world app"}'

# Check project created
curl http://localhost:3001/api/projects

# Check tasks
curl http://localhost:3001/api/tasks?planId={planId}

# Check queue stats
curl http://localhost:3001/api/admin/queue/stats
```

### Testing with Docker

```bash
# Build and run in Docker
docker-compose build
docker-compose up

# Run commands in sandbox
docker exec -it agentic-api-1 sh
```

---

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true`)
- Avoid `any` types
- Use explicit return types for exported functions
- Document complex logic with JSDoc

### React Components

- Use functional components with hooks
- Prop types via TypeScript interfaces
- Extract reusable logic to custom hooks

### File Organization

```
src/
├── components/        # Reusable components
├── lib/              # Utility functions
├── hooks/            # Custom hooks
├── types/            # Type definitions
└── app/              # Page components
```

---

## Submitting Changes

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bug
```

### 2. Make Changes

Follow the structure and style guidelines above.

### 3. Test Your Changes

```bash
# Run lint
npm run lint

# Type check
npm run build

# Test manually
npm run dev
```

### 4. Commit

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a pull request on GitHub.

---

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/tooling

**Examples:**
```
feat(agents): add reviewer agent role
fix(queue): prevent duplicate job processing
docs(readme): update API documentation
refactor(orchestrator): simplify task assignment
```

---

## Questions?

Open an issue on GitHub or reach out to the maintainers.
