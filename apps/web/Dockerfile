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

# Copy only the lock file and workspace config first
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy package.json files only (no source)
COPY package.json ./
COPY apps/web/package.json apps/web/

# Install dependencies (workspace links resolved)
RUN pnpm install --frozen-lockfile

# Now copy source
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.js apps/web/
COPY apps/web/next.config.mjs apps/web/
COPY apps/web/postcss.config.js apps/web/
COPY apps/web/tailwind.config.js apps/web/
COPY apps/web/tsconfig.json apps/web/

EXPOSE 3000

CMD ["pnpm", "--filter", "@agentic-os/web", "dev"]

# ============================================
# Production Stage
# ============================================
FROM base AS production

WORKDIR /app

# Install production deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile --prod

# Copy source and build
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.js apps/web/
COPY apps/web/next.config.mjs apps/web/
COPY apps/web/postcss.config.js apps/web/
COPY apps/web/tailwind.config.js apps/web/
COPY apps/web/tsconfig.json apps/web/

WORKDIR /app/apps/web
RUN pnpm build

# Final production image
FROM node:20-alpine

WORKDIR /app

# Install only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=production /app/apps/web/.next apps/web/.next
COPY --from=production /app/apps/web/public apps/web/public

# Create user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000

CMD ["node", "apps/web/node_modules/.bin/next", "start", "-p", "3000"]