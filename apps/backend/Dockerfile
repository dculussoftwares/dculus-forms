# Multi-stage Dockerfile for Dculus Forms Backend
# This Dockerfile should be built from the repository root
# docker build -f apps/backend/Dockerfile .

# Stage 1: Build stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

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

# Build shared packages first
RUN pnpm --filter @dculus/types build
RUN pnpm --filter @dculus/utils build

# Generate Prisma client and build backend
WORKDIR /app/apps/backend
RUN pnpm db:generate
RUN pnpm build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Set working directory
WORKDIR /app

# Copy built application and dependencies from builder stage
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/apps/backend/prisma ./prisma

# Change ownership to non-root user
RUN chown -R backend:nodejs /app
USER backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "dist/index.js"]