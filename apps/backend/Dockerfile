# Multi-stage Dockerfile for Dculus Forms Backend
# Stage 1: Build stage
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy all source files from repository root
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build shared packages first
RUN pnpm --filter @dculus/types build || echo "types build failed, continuing"
RUN pnpm --filter @dculus/utils build || echo "utils build failed, continuing"

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