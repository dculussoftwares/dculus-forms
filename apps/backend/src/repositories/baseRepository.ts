import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';

export interface RepositoryContext {
  /**
   * Optional Prisma client to scope repository calls.
   * Pass a transaction client here to keep multi-step flows atomic.
   */
  prisma?: PrismaClient;
}

/**
 * Resolve the Prisma client that a repository should use.
 * Falls back to the shared singleton unless a scoped client is provided.
 */
export const resolvePrisma = (
  context: RepositoryContext = {}
): PrismaClient => context.prisma ?? defaultPrisma;

/**
 * Helper for creating repositories that wrap a single Prisma delegate.
 * Useful when you only need raw access with a scoped client.
 */
export const createRepository = <Delegate extends object>(
  factory: (client: PrismaClient) => Delegate,
  context?: RepositoryContext
): Delegate => factory(resolvePrisma(context));

/**
 * Convenience helper for scoping repository calls to an existing Prisma client,
 * for example inside a transaction: `const repo = createFormRepository(withPrisma(tx))`.
 */
export const withPrisma = (prisma: PrismaClient): RepositoryContext => ({
  prisma,
});
