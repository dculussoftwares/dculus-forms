import { PrismaClient } from '@prisma/client';
import { appConfig } from './env.js';

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient();

if (!appConfig.isProduction) {
  globalThis.prisma = prisma;
}

export { prisma };
