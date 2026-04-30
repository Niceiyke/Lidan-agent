# ============================================
# Agentic OS - Makefile for Docker Development
# ============================================

.PHONY: help dev prod build up down logs ps clean

# Load environment from .env
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Default target
help:
	@echo "Agentic OS - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make logs         - View logs"
	@echo "  make ps           - Show running containers"
	@echo "  make clean        - Remove containers and volumes"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make build        - Build Docker images"
	@echo "  make up           - Start services"
	@echo "  make down         - Stop services"
	@echo ""
	@echo "Maintenance:"
	@echo "  make db-reset     - Reset database"
	@echo "  make db-migrate   - Run migrations"
	@echo "  make prune        - Clean up Docker"

# Development environment
dev:
	@echo "Starting Agentic OS in development mode..."
	@if [ ! -f .env ]; then cp .env.docker .env; fi
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "Services started:"
	@echo "  🌐 Web UI:    http://localhost:3000"
	@echo "  🔌 API:       http://localhost:3001"
	@echo "  📊 Traefik:   http://localhost:8080"
	@echo "  💾 Database:  localhost:5432"
	@echo "  ⚡ Redis:     localhost:6379"
	@echo ""
	@echo "Custom domains (add to /etc/hosts):"
	@echo "  127.0.0.1 lidan.wordlyte.com lidan-api.wordlyte.com"

# Production environment
prod:
	@echo "Building production images..."
	docker compose build --no-cache
	@echo ""
	@echo "Starting production environment..."
	docker compose up -d
	@echo ""
	@echo "Production URLs:"
	@echo "  🌐 Web UI:    https://lidan.wordlyte.com"
	@echo "  🔌 API:       https://lidan-api.wordlyte.com"

# Build images
build:
	@echo "Building Docker images..."
	docker compose build --no-cache
	@echo "✅ Build complete"

# Build development images
build-dev:
	@echo "Building development Docker images..."
	docker compose -f docker-compose.dev.yml build --no-cache
	@echo "✅ Build complete"

# Start services
up:
	@echo "Starting services..."
	docker compose up -d
	@echo "✅ Services started"

# Start dev services
up-dev:
	@echo "Starting development services..."
	docker compose -f docker-compose.dev.yml up -d
	@echo "✅ Services started"

# Stop services
down:
	@echo "Stopping services..."
	docker compose down
	@echo "✅ Services stopped"

# Stop dev services
down-dev:
	@echo "Stopping development services..."
	docker compose -f docker-compose.dev.yml down
	@echo "✅ Services stopped"

# View logs
logs:
	docker compose logs -f --tail=100

# View dev logs
logs-dev:
	docker compose -f docker-compose.dev.yml logs -f --tail=100

# Show containers
ps:
	@docker compose ps

# Show dev containers
ps-dev:
	@docker compose -f docker-compose.dev.yml ps

# Watch logs for specific service
logs-api:
	docker compose logs -f api

logs-web:
	docker compose logs -f web

logs-traefik:
	docker compose logs -f traefik

# Clean up everything
clean:
	@echo "⚠️  This will remove all containers and volumes..."
	@read -p "Continue? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker compose down -v --remove-orphans; \
		docker compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null; \
		echo "✅ Clean complete"; \
	else \
		echo "Cancelled"; \
	fi

# Database operations
db-reset:
	@echo "⚠️  This will delete all data..."
	@docker compose down -v
	@docker compose up -d postgres
	@sleep 5
	@echo "Database reset complete"

db-migrate:
	docker compose exec api npx prisma migrate deploy

db-shell:
	docker compose exec postgres psql -U agentic -d agentic_os

db-backup:
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	docker compose exec postgres pg_dump -U agentic agentic_os > backups/backup_$$timestamp.sql
	@echo "✅ Backup saved to backups/backup_$$timestamp.sql"

# Prune unused Docker resources
prune:
	docker system prune -f --volumes
	@echo "✅ Docker cleanup complete"

# Restart specific service
restart-api:
	docker compose restart api

restart-web:
	docker compose restart web

restart-all:
	docker compose restart

# Open shell in container
shell-api:
	docker compose exec api sh

shell-web:
	docker compose exec web sh

# Generate Prisma client
prisma-generate:
	docker compose exec api npx prisma generate

# Push to GitHub
push:
	git add -A
	git commit -m "$$(date +'%Y-%m-%d %H:%M') Docker setup"
	git push

# Quick start - dev with one command
start: dev

# Stop everything
stop: down-dev