# Agentic OS - Docker Deployment

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Niceiyke/Lidan-agent.git
cd Lidan-agent

# 2. Configure environment
cp .env.docker .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Start development environment
make dev

# 4. Access services
# - Web UI: http://localhost:3000
# - API: http://localhost:3001
```

## Production Deployment

### Prerequisites
- Docker & Docker Compose
- Domain names configured:
  - `lidan.wordlyte.com` → Your server
  - `lidan-api.wordlyte.com` → Your server
- DNS A records pointing to your server

### Setup

```bash
# 1. Copy environment file
cp .env.docker .env

# 2. Edit .env with your settings
vim .env

# 3. Build and start
make prod

# 4. Check services
make ps
make logs
```

## Services

| Service | Local URL | Production URL | Port |
|---------|-----------|----------------|------|
| Web UI | http://localhost:3000 | https://lidan.wordlyte.com | 3000 |
| API | http://localhost:3001 | https://lidan-api.wordlyte.com | 3001 |
| Traefik | http://localhost:8080 | - | 8080 |
| PostgreSQL | localhost:5432 | postgres:5432 | 5432 |
| Redis | localhost:6379 | redis:6379 | 6379 |

## Make Commands

```bash
make help          # Show all commands
make dev           # Start development
make prod          # Start production
make build         # Build images
make up            # Start services
make down          # Stop services
make logs          # View all logs
make logs-api      # View API logs
make logs-web      # View web logs
make ps            # Show containers
make clean         # Remove everything

# Database
make db-migrate    # Run migrations
make db-shell      # Open psql shell
make db-backup     # Backup database
```

## Traefik Configuration

Traefik is configured with:
- Automatic HTTPS (Let's Encrypt)
- HTTP → HTTPS redirect
- Custom domains via labels

### Custom Domains

Add to your `/etc/hosts` (development):
```
127.0.0.1 lidan.wordlyte.com
127.0.0.1 lidan-api.wordlyte.com
```

### Production DNS

Set these DNS records:
- `A` record: `lidan.wordlyte.com` → server IP
- `A` record: `lidan-api.wordlyte.com` → server IP

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your-key-here

# Database
POSTGRES_PASSWORD=agentic_dev

# Optional
LOG_LEVEL=info
```

## Volumes

| Volume | Description |
|--------|-------------|
| `postgres_data` | PostgreSQL database |
| `redis_data` | Redis cache |
| `workspaces` | Agentic workspaces |
| `traefik_certs` | SSL certificates |

## Troubleshooting

```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Restart a service
docker compose restart api

# Rebuild without cache
docker compose build --no-cache

# Reset everything
make clean && make dev
```

## Security

- Non-root users in containers
- Secrets via environment variables
- Automatic HTTPS via Let's Encrypt
- Traefik middleware for headers