# Multi-stage Dockerfile for Dculus Forms Backend
# Stage 1: Build stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace and package configuration first (from repo root)
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy packages directory for workspace dependencies
COPY packages/ ./packages/

# Copy backend package.json
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (including workspace dependencies)
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter @dculus/types build
RUN pnpm --filter @dculus/utils build

# Copy backend source code (excluding .env files via .dockerignore)
COPY apps/backend/ ./apps/backend/

# Set working directory to backend
WORKDIR /app/apps/backend

# Generate Prisma client
RUN pnpm db:generate

# Build the application
RUN pnpm build

# Stage 2: Production stage
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy workspace and package configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy packages directory for workspace dependencies
COPY packages/ ./packages/

# Copy backend package.json
COPY apps/backend/package.json ./apps/backend/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application and generated files from builder stage
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# Change ownership to non-root user
RUN chown -R backend:nodejs /app
USER backend

# Set working directory to backend
WORKDIR /app/apps/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Start the application
CMD ["node", "dist/index.js"]