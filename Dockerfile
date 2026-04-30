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

# Copy all workspace files first (critical for pnpm to see workspace)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy ALL packages first (required for workspace resolution)
COPY packages/types/package.json packages/types/
COPY packages/pi-extensions/package.json packages/pi-extensions/
COPY packages/pi-skills/package.json packages/pi-skills/
COPY packages/pi-wrapper/package.json packages/pi-wrapper/

# Copy ALL apps
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install ALL dependencies (so workspace links are resolved)
RUN pnpm install

# Copy source code
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

# Copy all workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json packages/types/
COPY packages/pi-extensions/package.json packages/pi-extensions/
COPY packages/pi-skills/package.json packages/pi-skills/
COPY packages/pi-wrapper/package.json packages/pi-wrapper/
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
COPY packages/types/package.json packages/types/

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