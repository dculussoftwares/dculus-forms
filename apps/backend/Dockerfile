# Multi-stage Dockerfile for Dculus Forms Backend
# This Dockerfile should be built from the repository root
# docker build -f apps/backend/Dockerfile .

# --- Stage 1: Builder ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared packages
RUN pnpm --filter @dculus/types build
RUN pnpm --filter @dculus/utils build

# Generate Prisma client and build backend
WORKDIR /app/apps/backend
RUN pnpm db:generate
RUN pnpm build

# Prune dev dependencies to reduce size for the next stage
RUN pnpm prune --prod

# --- Stage 2: Runner ---
FROM --platform=$BUILDPLATFORM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Copy built artifacts from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy backend specific files
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Change ownership to non-root user
RUN chown -R backend:nodejs /app

# Switch to backend user
USER backend

# Set final working directory
WORKDIR /app/apps/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Create startup script
RUN echo '#!/bin/sh' > /app/apps/backend/start.sh && \
    echo 'echo "🔄 Running database migrations..."' >> /app/apps/backend/start.sh && \
    echo 'npx prisma db push --accept-data-loss || { echo "❌ Migration failed"; exit 1; }' >> /app/apps/backend/start.sh && \
    echo 'echo "✅ Database migrations completed"' >> /app/apps/backend/start.sh && \
    echo 'echo "🔍 Checking if database needs seeding..."' >> /app/apps/backend/start.sh && \
    echo 'if [ "$RUN_SEED" = "true" ]; then' >> /app/apps/backend/start.sh && \
    echo '  echo "🌱 Running database seed..."' >> /app/apps/backend/start.sh && \
    echo '  node dist/apps/backend/src/scripts/seed.js || echo "⚠️  Seed failed, continuing anyway"' >> /app/apps/backend/start.sh && \
    echo 'else' >> /app/apps/backend/start.sh && \
    echo '  echo "⏭️  Skipping seed (RUN_SEED not set to true)"' >> /app/apps/backend/start.sh && \
    echo 'fi' >> /app/apps/backend/start.sh && \
    echo 'echo "🚀 Starting application..."' >> /app/apps/backend/start.sh && \
    echo 'exec node dist/apps/backend/src/index.js' >> /app/apps/backend/start.sh && \
    chmod +x /app/apps/backend/start.sh

# Start the application
CMD ["/bin/sh", "/app/apps/backend/start.sh"]