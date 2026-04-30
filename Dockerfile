# ============================================
# Agentic OS - Dockerfile with Multi-Stage Build
# ============================================

# ============================================
# Base Stage
# ============================================
FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable

# ============================================
# Development Stage
# ============================================
FROM base AS development

WORKDIR /app

# Copy only the lock file and workspace config first
# This allows pnpm to resolve workspace dependencies without copying all packages
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy all package.json files (but NOT the source)
COPY package.json ./
COPY packages/*/package.json packages/
COPY apps/*/package.json apps/

# Install ALL dependencies (workspace links will be resolved)
# No need to copy source code first - just install from package.json files
RUN pnpm install --frozen-lockfile

# Now copy the source code
COPY packages packages/
COPY apps/api/src apps/api/src/
COPY apps/api/prisma apps/api/prisma/
COPY apps/web/src apps/web/src/

# Create workspaces directory
RUN mkdir -p /workspaces /tmp/agentic-workspaces

EXPOSE 3001

CMD ["pnpm", "--filter", "@agentic-os/api", "dev"]

# ============================================
# Production Stage
# ============================================
FROM base AS production

WORKDIR /app

# Install production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/

RUN corepack enable && pnpm install --frozen-lockfile --prod

# Build API
COPY apps/api/src apps/api/src/
COPY apps/api/prisma apps/api/prisma/
WORKDIR /app/apps/api
RUN pnpm build

# Copy built artifacts back
WORKDIR /app
RUN mkdir -p dist/apps/api && cp -r apps/api/dist dist/apps/api

# Final production image
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/

RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=production /app/dist/apps/api apps/api/dist
COPY --from=production /app/apps/api/prisma apps/api/prisma

# Create user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /workspaces && \
    chown -R nodejs:nodejs /workspaces

USER nodejs

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]