import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '#prisma-client';
import { appConfig } from './env.js';
import { credentialEncryption } from './credentialEncryptionExtension.js';
import { assertSecureDatabaseUrl, isLocalDatabase } from './databaseUrl.js';

export { isLocalDatabase };

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function positiveIntFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Build the pg driver adapter.
 *
 * In production (PgBouncer transaction mode) the app-side pool stays small
 * (DB_POOL_MAX, default 2) — PgBouncer handles real server-side pooling. The adapter does not
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

  assertSecureDatabaseUrl(connectionString, appConfig.isProduction);

  const max = isLocalDatabase(connectionString) ? undefined : positiveIntFromEnv('DB_POOL_MAX', 2);

  // query_timeout is enforced client-side: a server-side statement_timeout startup
  // parameter is rejected by PgBouncer unless it is explicitly ignored.
  return new PrismaPg({
    connectionString,
    max,
    connectionTimeoutMillis: positiveIntFromEnv('DB_CONNECTION_TIMEOUT_MS', 10_000),
    query_timeout: positiveIntFromEnv('DB_QUERY_TIMEOUT_MS', 60_000),
  });
}

const baseClient = globalThis.prisma || new PrismaClient({ adapter: buildAdapter() });

if (!appConfig.isProduction) {
  globalThis.prisma = baseClient;
}

// Plugin / automation credentials are encrypted at rest; see lib/credentialCrypto.ts. The extended
// client is exposed as a PrismaClient so existing repository / transaction typings keep working.
const prisma = baseClient.$extends(credentialEncryption) as unknown as PrismaClient;

export { prisma };
