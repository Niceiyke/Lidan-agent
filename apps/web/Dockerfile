# ============================================
# Agentic OS Web - Next.js Dockerfile
# ============================================

FROM node:20-alpine AS base

WORKDIR /app

RUN corepack enable

# ============================================
# Development Stage
# ============================================
FROM base AS development

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy web package files
COPY apps/web/package.json apps/web/

# Install web dependencies (from monorepo)
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.js apps/web/
COPY apps/web/next.config.mjs apps/web/
COPY apps/web/postcss.config.js apps/web/
COPY apps/web/tailwind.config.js apps/web/
COPY apps/web/tsconfig.json apps/web/

# Expose port
EXPOSE 3000

# Development command
CMD ["pnpm", "--filter", "@agentic-os/web", "dev"]

# ============================================
# Production Stage
# ============================================
FROM base AS production

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source for build
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.js apps/web/
COPY apps/web/next.config.mjs apps/web/
COPY apps/web/postcss.config.js apps/web/
COPY apps/web/tailwind.config.js apps/web/
COPY apps/web/tsconfig.json apps/web/

# Build
WORKDIR /app/apps/web
RUN pnpm build

# Back to app root
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000

CMD ["node", "apps/web/node_modules/.bin/next", "start", "-p", "3000"]