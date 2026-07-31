import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for database-wide (non-model-specific) raw queries used by the
 * admin dashboard's PostgreSQL stats and system health check. Not tied to
 * any single Prisma model, hence its own small repository.
 */
export const createSystemRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** Human-readable total database size (e.g. "128 MB"). */
  const getDatabaseSizePretty = async (): Promise<string> => {
    const result = await prisma.$queryRaw<
      [{ size: string }]
    >`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`;
    return result[0]?.size ?? '0 B';
  };

  /** Count of base tables in the `public` schema. */
  const getPublicTableCount = async (): Promise<number> => {
    const result = await prisma.$queryRaw<
      [{ count: bigint }]
    >`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    return Number(result[0]?.count ?? 0);
  };

  /** Lightweight liveness check for the system health panel. */
  const ping = async (): Promise<void> => {
    await prisma.$queryRaw`SELECT 1`;
  };

  return {
    getDatabaseSizePretty,
    getPublicTableCount,
    ping,
  };
};

export type SystemRepository = ReturnType<typeof createSystemRepository>;

export const systemRepository = createSystemRepository();
