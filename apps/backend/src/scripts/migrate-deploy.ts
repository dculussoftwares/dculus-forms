import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Safe migration runner for CI and production deployments.
 *
 * Handles two cases automatically:
 *
 * 1. Existing database (was previously managed by `db:push`, no migration
 *    history) — detects this by checking for the `_prisma_migrations` table.
 *    Resolves the baseline migration as "already applied" so Prisma does not
 *    try to re-create tables that already exist, then runs `migrate deploy`
 *    to apply any new migrations.
 *
 * 2. Fresh database — `_prisma_migrations` table is absent AND no schema
 *    exists yet. Runs `migrate deploy` directly so all migrations are applied
 *    from scratch.
 */

const BASELINE_MIGRATION = '20250519000000_init';

async function main() {
  const prisma = new PrismaClient();

  try {
    const [{ has_migration_table }] = await prisma.$queryRaw<[{ has_migration_table: boolean }]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = '_prisma_migrations'
      ) AS has_migration_table
    `;

    if (!has_migration_table) {
      const [{ has_schema }] = await prisma.$queryRaw<[{ has_schema: boolean }]>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'user'
        ) AS has_schema
      `;

      if (has_schema) {
        console.log('Existing database detected (no migration history). Resolving baseline...');
        execSync(`npx prisma migrate resolve --applied ${BASELINE_MIGRATION}`, { stdio: 'inherit' });
        console.log('Baseline resolved.');
      } else {
        console.log('Fresh database detected. Migrations will be applied from scratch.');
      }
    } else {
      console.log('Migration history found. Applying any pending migrations...');

      // Detect migrations that started but never finished (P3009 failure state).
      // Resolve each as rolled-back so migrate deploy can re-apply them with the
      // current (idempotent) SQL file content.
      const failedMigrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations
        WHERE started_at IS NOT NULL
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
      `;

      for (const { migration_name } of failedMigrations) {
        console.log(`Found failed migration: ${migration_name}. Resolving as rolled-back so it can be re-applied...`);
        execSync(`npx prisma migrate resolve --rolled-back ${migration_name}`, { stdio: 'inherit' });
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
