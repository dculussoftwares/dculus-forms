# Single-stage Dockerfile for Dculus Forms Backend
# This Dockerfile should be built from the repository root
# docker build -f apps/backend/Dockerfile .

FROM --platform=$BUILDPLATFORM node:18-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build shared packages (ESM for all)
RUN pnpm --filter @dculus/types build
RUN pnpm --filter @dculus/utils build

# Generate Prisma client and build backend
WORKDIR /app/apps/backend
RUN pnpm db:generate
RUN pnpm build

# For now, use single-stage build to avoid copy issues
# TODO: Optimize with multi-stage build once working

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Change ownership to non-root user and switch to backend user
RUN chown -R backend:nodejs /app
USER backend

# Set final working directory
WORKDIR /app/apps/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Create startup script that runs seed before starting the app
RUN echo '#!/bin/sh' > /app/apps/backend/start.sh && \
    echo 'echo "🔍 Checking if database needs seeding..."' >> /app/apps/backend/start.sh && \
    echo 'if [ "$RUN_SEED" = "true" ]; then' >> /app/apps/backend/start.sh && \
    echo '  echo "🌱 Running database seed..."' >> /app/apps/backend/start.sh && \
    echo '  node dist/scripts/seed.js || echo "⚠️  Seed failed, continuing anyway"' >> /app/apps/backend/start.sh && \
    echo 'else' >> /app/apps/backend/start.sh && \
    echo '  echo "⏭️  Skipping seed (RUN_SEED not set to true)"' >> /app/apps/backend/start.sh && \
    echo 'fi' >> /app/apps/backend/start.sh && \
    echo 'echo "🚀 Starting application..."' >> /app/apps/backend/start.sh && \
    echo 'exec node dist/index.js' >> /app/apps/backend/start.sh && \
    chmod +x /app/apps/backend/start.sh

# Start the application with startup script
CMD ["/bin/sh", "/app/apps/backend/start.sh"]