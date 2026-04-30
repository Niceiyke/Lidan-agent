# Planner Skill

> Software architecture and task decomposition for Agentic OS

## Overview

The planner skill helps break down project goals into actionable, prioritized tasks.

## Capabilities

- **Goal Analysis**: Understand project requirements and constraints
- **Task Decomposition**: Break goals into concrete, achievable tasks
- **Dependency Mapping**: Identify task dependencies and critical path
- **Priority Assignment**: Set priorities based on impact and dependencies
- **Estimation**: Provide rough time estimates for tasks

## Usage

The planner receives a project goal and outputs structured tasks:

```
/skill:planner
```

Or the goal can be passed as arguments:

```
/skill:planner Build a todo app with auth and real-time updates
```

## Output Format

```json
{
  "tasks": [
    {
      "title": "Setup project structure",
      "type": "planning",
      "description": "Initialize Next.js project with TypeScript and required dependencies",
      "priority": "high",
      "dependencies": [],
      "estimatedTime": "30m"
    },
    {
      "title": "Implement authentication",
      "type": "coding",
      "description": "Create user registration, login, and session management",
      "priority": "high",
      "dependencies": [0],
      "estimatedTime": "2h"
    }
  ]
}
```

## Task Types

| Type | Description |
|------|-------------|
| `planning` | Architecture and design tasks |
| `coding` | Feature implementation |
| `review` | Code review and security audit |
| `testing` | Test writing and execution |
| `debugging` | Issue investigation and fixing |

## Priority Levels

| Priority | Meaning |
|----------|---------|
| `critical` | Must complete before anything else |
| `high` | Core functionality |
| `medium` | Important but not blocking |
| `low` | Nice to have |

## Best Practices

1. **Start with the foundation** - Setup tasks before feature tasks
2. **Identify dependencies early** - Plan the critical path
3. **Keep tasks atomic** - Each task should be completable in one go
4. **Prioritize testing** - Plan tests alongside features
5. **Consider review cycles** - Build in time for code review

## Guidelines

- Tasks should be actionable (not vague)
- Descriptions should provide enough context for a coder
- Consider edge cases and error handling
- Include database schema tasks when needed
- Plan for deployment and documentation

## Example

Given:
> A real-time collaborative whiteboard application

The planner might output:
1. Project setup (Next.js, TypeScript, WebSocket libs)
2. Database schema (users, boards, elements)
3. User authentication
4. Board CRUD operations
5. WebSocket server setup
6. Real-time sync implementation
7. Drawing tools implementation
8. Integration tests
9. Deployment configuration

---

*Part of Agentic OS - AI-Powered Software Factory*
