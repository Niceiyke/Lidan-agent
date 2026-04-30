# ============================================
# Agentic OS Web - Next.js Dockerfile
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY apps/web/package.json apps/web/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source
COPY apps/web/src apps/web/src/
COPY apps/web/public apps/web/public/
COPY apps/web/next.config.js apps/web/
COPY apps/web/postcss.config.js apps/web/
COPY apps/web/tailwind.config.ts apps/web/
COPY apps/web/tsconfig.json apps/web/

# Build
RUN cd apps/web && pnpm build

# ============================================
# Production stage
# ============================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies
COPY apps/web/package.json apps/web/
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/public apps/web/public

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000

CMD ["node", "apps/web/node_modules/.bin/next", "start", "-p", "3000"]