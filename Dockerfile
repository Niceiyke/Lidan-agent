# ============================================
# Agentic OS - Dockerfile with Multi-Stage Build
# ============================================

# ============================================
# Base Stage
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
RUN corepack enable

# ============================================
# Development Stage
# ============================================
FROM base AS development

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install all dependencies (including dev)
RUN pnpm install

# Copy source
COPY packages packages/
COPY apps/api/src apps/api/src/
COPY apps/api/prisma apps/api/prisma/
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/

# Create workspaces directory
RUN mkdir -p /workspaces /tmp/agentic-workspaces

# Expose port
EXPOSE 3001

# Development command with tsx for hot-reload
CMD ["pnpm", "--filter", "@agentic-os/api", "dev"]

# ============================================
# Builder Stage
# ============================================
FROM base AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN pnpm install

# Copy source
COPY packages packages/
COPY apps/api/src apps/api/src/
COPY apps/api/prisma apps/api/prisma/

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Copy built API to output
WORKDIR /app
RUN mkdir -p dist/apps/api && cp -r apps/api/dist dist/apps/api

# ============================================
# Production Stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/

RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/dist/apps/api apps/api/dist

# Copy Prisma schema
COPY --from=builder /app/apps/api/prisma apps/api/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create workspaces directory
RUN mkdir -p /workspaces && chown -R nodejs:nodejs /workspaces

USER nodejs

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start API server
CMD ["node", "apps/api/dist/index.js"]