import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/prisma.js';

export interface RepositoryContext {
  prisma?: PrismaClient;
}

export const resolvePrisma = (
  context: RepositoryContext = {}
): PrismaClient => context.prisma ?? defaultPrisma;

export const createRepository = <Delegate extends object>(
  factory: (client: PrismaClient) => Delegate,
  context?: RepositoryContext
): Delegate => factory(resolvePrisma(context));
