import { PrismaClient } from '@prisma/client';
import { appConfig } from './env.js';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Build the runtime DATABASE_URL.
 *
 * In production (PgBouncer transaction mode) Prisma needs two extra params:
 *   - pgbouncer=true      → disables prepared statements, which PgBouncer
 *                           transaction mode does not support across connections
 *   - connection_limit=2  → keeps the app-side pool small; PgBouncer handles
 *                           real server-side pooling
 *
 * We inject them here so that all deployments are safe even if the env var
 * was set without them.
 */
function buildDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  // Only inject PgBouncer params when the URL targets PgBouncer (not local dev).
  // We detect this by the absence of localhost/127.0.0.1.
  if (raw.includes('localhost') || raw.includes('127.0.0.1')) {
    return raw;
  }

  const url = new URL(raw);
  if (!url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
  }
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '2');
  }
  return url.toString();
}

const datasourceUrl = buildDatasourceUrl();

const prisma =
  globalThis.prisma ||
  new PrismaClient(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : undefined);

if (!appConfig.isProduction) {
  globalThis.prisma = prisma;
}

export { prisma };
