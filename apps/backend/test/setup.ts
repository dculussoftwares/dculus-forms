import { PrismaClient } from '#prisma-client';
import { beforeAll, afterAll, afterEach } from 'vitest';

// For unit tests with mocked Prisma, we don't need a real connection — just a
// syntactically valid DATABASE_URL so that modules which eagerly construct the
// Prisma driver adapter at import time (e.g. src/lib/prisma.ts) don't throw
// before mocks are wired up. This must run at module top-level (not inside
// beforeAll) because vitest fully evaluates setupFiles — including resolving
// this assignment — before importing the test file, whereas beforeAll hooks
// only run once the test suite itself executes, which is too late for
// module-level side effects triggered by the test file's own imports.
if (!process.env.DATABASE_URL) {
  // Set a dummy URL for mocked tests that don't actually connect
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test';
}

let prisma: PrismaClient;

// Setup for unit tests - using mocked Prisma client
// For integration tests, use the real PostgreSQL connection
beforeAll(async () => {
  // Initialize Prisma client (will be mocked in individual test files)
  prisma = new PrismaClient();
}, 30000);

// Clean up database after each test
afterEach(async () => {
  // Simple cleanup - for auth utils tests, no database cleanup needed
  // For service tests, specific cleanup can be added per test file
});

// Close Prisma connection after all tests
afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

// Export prisma client for use in tests
export { prisma };
