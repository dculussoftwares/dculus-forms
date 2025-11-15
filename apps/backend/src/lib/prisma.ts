import { PrismaClient } from '@prisma/client';
import { appConfig } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = globalThis.prisma || new PrismaClient();

if (!appConfig.isProduction) {
  globalThis.prisma = prisma;
}

export { prisma };
