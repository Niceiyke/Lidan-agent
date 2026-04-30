# Agentic OS - Docker Development Guide

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your API key
vim .env

# 3. Start development
make dev

# 4. Access services
# - Web UI:    http://localhost:3000
# - API:       http://localhost:3001
# - Traefik:   http://localhost:8080
```

## Environment Configuration

Edit `.env` file with your settings:

```bash
# Required: AI Provider API Key
ANTHROPIC_API_KEY=your-key-here

# Database (auto-configured)
DATABASE_URL=postgresql://agentic:agentic_dev@localhost:5432/agentic_os

# Redis (auto-configured)
REDIS_URL=redis://localhost:6379
```

## Make Commands

```bash
make help          # Show all commands
make dev           # Start development environment
make dev-up        # Start dev services
make dev-down      # Stop dev services
make dev-logs      # View dev logs
make dev-ps        # Show dev containers

make prod          # Build and start production
make build         # Build images
make up            # Start services
make down          # Stop services
make logs          # View logs

# Database
make db-migrate    # Run Prisma migrations
make db-shell      # Open psql shell
make db-backup     # Backup database

# Cleanup
make clean         # Remove everything
make prune         # Docker cleanup
```

## Development Features

- **Hot Reload**: Source code changes reflected immediately
- **Persistent Data**: Workspaces and databases persist in volumes
- **Traefik**: Reverse proxy with automatic routing
- **Port Exposure**: All services accessible on localhost

## Service URLs (Development)

| Service | URL | Description |
|---------|-----|-------------|
| Web UI | http://localhost:3000 | Next.js dashboard |
| API | http://localhost:3001 | Hono API server |
| Traefik | http://localhost:8080 | Dashboard |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Queue |

## Custom Domains (Optional)

Add to `/etc/hosts` for custom domain access:

```
127.0.0.1 lidan.wordlyte.com
127.0.0.1 lidan-api.wordlyte.com
```

Then access:
- Web: http://lidan.wordlyte.com
- API: http://lidan-api.wordlyte.com/api

## Production Deployment

For production with HTTPS and custom domains:

```bash
# 1. Set DNS A records:
#    lidan.wordlyte.com → server IP
#    lidan-api.wordlyte.com → server IP

# 2. Update .env for production
export NODE_ENV=production
export CORS_ORIGIN=https://lidan.wordlyte.com

# 3. Start production
make prod
```

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production stack |
| `docker-compose.dev.yml` | Development stack |

## Troubleshooting

```bash
# View all logs
make logs

# View specific service logs
make logs-api
make logs-web
make logs-traefik

# Rebuild without cache
docker compose -f docker-compose.dev.yml build --no-cache

# Reset everything
make clean && make dev

# Check container status
docker compose -f docker-compose.dev.yml ps
```

## Docker-in-Docker

The API container has access to the Docker socket for:
- Building sandbox images
- Running containers for projects
- Managing Docker resources

## Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `workspaces_dev` | `/workspaces` | Project files |
| `postgres_data_dev` | PostgreSQL data | Database storage |
| `redis_data_dev` | Redis data | Cache & queue |

## Security Notes

- API key stored in `.env` (not committed to git)
- Non-root users in containers
- Port exposure for local development only
- Production should use Traefik with HTTPS