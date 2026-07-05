import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
import { appConfig } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export function isLocalDatabase(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Build the pg driver adapter.
 *
 * In production (PgBouncer transaction mode) we keep the app-side pool small
 * (max: 2) — PgBouncer handles real server-side pooling. The adapter does not
 * send named/prepared statements unless a statementNameGenerator is supplied
 * (we don't supply one), which is required for PgBouncer transaction mode
 * compatibility — this replaces the old `pgbouncer=true` query-string flag
 * that the removed query-engine binary used to read.
 */
function buildAdapter(): PrismaPg {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const max = isLocalDatabase(connectionString) ? undefined : 2;

  return new PrismaPg({ connectionString, max });
}

const prisma = globalThis.prisma || new PrismaClient({ adapter: buildAdapter() });

if (!appConfig.isProduction) {
  globalThis.prisma = prisma;
}

export { prisma };
