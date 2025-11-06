import { MongoMemoryServer } from 'mongodb-memory-server';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, afterEach } from 'vitest';

let mongoServer: MongoMemoryServer;
let prisma: PrismaClient;

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'test_db', // Provide explicit database name
    },
  });
  const mongoUri = mongoServer.getUri();

  // Set environment variable for Prisma
  process.env.DATABASE_URL = mongoUri;

  // Initialize Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: mongoUri,
      },
    },
  });

  // Apply migrations/schema
  await prisma.$connect();
}, 60000); // 60 second timeout for MongoDB startup

// Clean up database after each test
afterEach(async () => {
  // Simple cleanup - for auth utils tests, no database cleanup needed
  // For service tests, specific cleanup can be added per test file
});

// Stop MongoDB and close connections after all tests
afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Export prisma client for use in tests
export { prisma };
