import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'vitest-mock-extended';
import { beforeEach } from 'vitest';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>() as MockPrismaClient;

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Helper to create mock transaction context
export const createMockTransaction = () => {
  return mockDeep<PrismaClient>();
};
