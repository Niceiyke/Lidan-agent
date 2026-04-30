# ============================================
# Agentic OS - Production Dockerfile
# ============================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages packages/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source code
COPY packages packages/
COPY apps/api/src apps/api/src/
COPY apps/api/prisma apps/api/prisma/

# Build API
WORKDIR /app/apps/api
RUN pnpm build

# Build Web
WORKDIR /app/apps/web
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
RUN pnpm build

# ============================================
# Production stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/public apps/web/public

# Copy source for Prisma
COPY --from=builder /app/apps/api/prisma apps/api/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create workspaces directory
RUN mkdir -p /workspaces /tmp/agentic-workspaces && \
    chown -R nodejs:nodejs /workspaces /tmp

USER nodejs

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=postgresql://agentic:agentic_dev@postgres:5432/agentic_os
ENV REDIS_URL=redis://redis:6379
ENV WORKSPACES_PATH=/workspaces
ENV CORS_ORIGIN=*

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start API server
CMD ["node", "apps/api/dist/index.js"]