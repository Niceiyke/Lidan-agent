# Tester Skill

> Test writing and execution for Agentic OS agents

## Overview

The tester skill guides AI agents in writing comprehensive tests and verifying functionality.

## Capabilities

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API routes and database operations
- **E2E Tests**: Test full user workflows
- **Test Execution**: Run tests and interpret results
- **Coverage Analysis**: Identify untested code paths

## Usage

```bash
/skill:tester
```

## Testing Frameworks

### JavaScript/TypeScript

- **Jest** - Default for most projects
- **Vitest** - Vite-native alternative
- **Playwright** - E2E testing

### Testing Structure

```
tests/
├── unit/
│   ├── services/
│   └── utils/
├── integration/
│   └── api/
└── e2e/
    └── flows/
```

## Test Patterns

### Arrange-Act-Assert

```typescript
describe('createUser', () => {
  it('creates user with hashed password', async () => {
    // Arrange
    const input = { email: 'test@example.com', password: 'secret123' };
    
    // Act
    const user = await createUser(input);
    
    // Assert
    expect(user.email).toBe(input.email);
    expect(user.password).not.toBe(input.password);
    expect(user.password.startsWith('$2b$')).toBe(true);
  });
});
```

### Given-When-Then

```typescript
describe('User authentication', () => {
  given('a registered user', () => {
    const user = await createUser({ email: 'test@example.com', password: 'secret' });
    return user;
  });
  
  when('they log in with correct credentials', () => {
    return authenticate('test@example.com', 'secret');
  });
  
  then('they should receive a session token', (result) => {
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@example.com');
  });
});
```

## Edge Cases to Test

### Input Validation
- Empty inputs
- Invalid formats (email, URL, etc.)
- Boundary values
- Special characters

### Error Handling
- Network failures
- Database errors
- Invalid data
- Concurrent modifications

### Security
- SQL injection attempts
- XSS payloads
- Authentication bypass
- Authorization failures

## Test Coverage Guidelines

| Coverage | Purpose |
|----------|---------|
| 80%+ | Good baseline |
| 90%+ | High confidence |
| 100% | Required for critical paths |

Focus coverage on:
1. Business logic
2. Error handling
3. Security-critical code
4. API endpoints

## Running Tests

### All Tests
```bash
npm test
```

### Specific Files
```bash
npm test -- src/services/user.test.ts
```

### With Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

## Mocking

### Functions
```typescript
vi.mock('./email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));
```

### Modules
```typescript
vi.mock('node:fs', () => ({
  readFile: vi.fn().mockResolvedValue('test content'),
}));
```

### Time
```typescript
vi.useFakeTimers();
vi.setSystemTime(new Date('2024-01-01'));
```

## Checklist

Before marking tests complete:

- [ ] Unit tests for all new functions
- [ ] Integration tests for API routes
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] All tests passing
- [ ] Coverage acceptable
- [ ] No skipped tests in production code

## Common Issues

### Flaky Tests
- Avoid timing dependencies
- Use fake timers
- Mock external services
- Clean up after each test

### Slow Tests
- Mock heavy dependencies
- Use in-memory databases
- Run tests in parallel
- Focus on critical paths

---

*Part of Agentic OS - AI-Powered Software Factory*
