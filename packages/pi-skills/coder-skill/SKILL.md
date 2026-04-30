# Coder Skill

> Code implementation skill for Agentic OS agents

## Overview

The coder skill guides AI agents in implementing features with clean, maintainable code.

## Capabilities

- **Feature Implementation**: Write production-ready code
- **File Operations**: Create and modify files safely
- **Dependency Management**: Install and configure packages
- **Build & Test**: Run builds and tests locally
- **Git Workflow**: Commit changes with descriptive messages

## Usage

The coder receives a task description and implements it:

```
/skill:coder
```

## Guidelines

### File Creation

1. Use `write` tool for new files
2. Place files in appropriate directories
3. Follow project conventions

### Code Style

1. Use TypeScript for type safety
2. Add JSDoc comments for complex functions
3. Follow existing naming conventions
4. Keep functions small and focused

### Testing

1. Write tests alongside features
2. Use descriptive test names
3. Test edge cases and errors
4. Run tests after implementation

### Git Workflow

1. Commit often with clear messages
2. Use present tense: "Add feature" not "Added feature"
3. Reference task in commit if available

## Tools Available

| Tool | Purpose |
|------|---------|
| `read` | Read file contents |
| `bash` | Run shell commands |
| `write` | Create new files |
| `edit` | Modify existing files |

## Safety Rules

1. **Never delete system files**
2. **Check before overwriting**
3. **Use /workspace paths only**
4. **Commit before major changes**

## Example Task Response

```typescript
// Task: Create a user service

// Implementation steps:
// 1. Create src/services/user.service.ts
// 2. Add type definitions
// 3. Write unit tests
// 4. Export from index.ts
// 5. Run tests to verify
```

## Common Patterns

### Next.js Page
```typescript
// app/users/page.tsx
export default async function UsersPage() {
  const users = await getUsers();
  return <UserList users={users} />;
}
```

### API Route
```typescript
// app/api/users/route.ts
export async function GET() {
  const users = await db.user.findMany();
  return Response.json(users);
}
```

### Service with Tests
```typescript
// src/services/user.service.ts
export async function createUser(data: CreateUserInput) {
  const hashed = await bcrypt.hash(data.password, 10);
  return db.user.create({ data: { ...data, password: hashed } });
}

// src/services/user.service.test.ts
describe('createUser', () => {
  it('hashes password', async () => {
    const user = await createUser({ email: 'test@example.com', password: 'secret' });
    expect(user.password).not.toBe('secret');
  });
});
```

## Error Handling

1. Always handle errors gracefully
2. Log errors with context
3. Return meaningful error messages
4. Don't expose internal details to users

## Checklist

Before marking a task complete:

- [ ] All files created/modified
- [ ] Code follows style guide
- [ ] JSDoc comments added
- [ ] Tests written and passing
- [ ] Changes committed to git
- [ ] No console.log statements (except debugging)

---

*Part of Agentic OS - AI-Powered Software Factory*
