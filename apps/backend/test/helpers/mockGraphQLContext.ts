import { MockAuthContext } from './mockAuth';
import { PrismaClient } from '@prisma/client';
import { prismaMock } from './mockPrisma';

export interface MockGraphQLContext extends MockAuthContext {
  prisma: PrismaClient;
  req: any;
  res: any;
}

export const createMockGraphQLContext = (
  authContext: MockAuthContext
): MockGraphQLContext => ({
  ...authContext,
  prisma: prismaMock as unknown as PrismaClient,
  req: {
    headers: {},
    ip: '127.0.0.1',
  },
  res: {
    setHeader: vi.fn(),
  },
});
