import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, afterEach } from 'vitest';

let prisma: PrismaClient;

// Setup for unit tests - using mocked Prisma client
// For integration tests, use the real PostgreSQL connection
beforeAll(async () => {
  // For unit tests with mocked Prisma, we don't need a real connection
  // Just initialize client with default DATABASE_URL from .env
  if (!process.env.DATABASE_URL) {
    // Set a dummy URL for mocked tests that don't actually connect
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test';
  }

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
