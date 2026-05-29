import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

/**
 * Safe migration runner for CI and production deployments.
 *
 * Handles two cases automatically:
 *
 * 1. Existing database (was previously managed by `db:push`, no migration
 *    history) — detects this by checking for the `_prisma_migrations` table.
 *    Resolves ALL known migrations as "already applied" so Prisma does not
 *    try to re-create tables/indexes that already exist, then runs
 *    `migrate deploy` to apply only genuinely new migrations.
 *
 * 2. Fresh database — `_prisma_migrations` table is absent AND no schema
 *    exists yet. Runs `migrate deploy` directly so all migrations are applied
 *    from scratch.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

function getAllMigrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter(name => name !== 'migration_lock.toml' && !name.startsWith('.'))
    .sort();
}

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
        // Existing database with full schema but no migration history.
        // Resolve ALL migrations as already applied so none are re-run.
        const migrations = getAllMigrationNames();
        console.log(`Existing database detected (no migration history). Resolving ${migrations.length} migrations as baseline...`);
        for (const migration of migrations) {
          execSync(`npx prisma migrate resolve --applied ${migration}`, { stdio: 'inherit' });
        }
        console.log('All migrations resolved as baseline.');
      } else {
        console.log('Fresh database detected. Migrations will be applied from scratch.');
      }
    } else {
      console.log('Migration history found. Applying any pending migrations...');

      // Detect migrations that started but never finished (P3009 failure state).
      // Resolve each as rolled-back so migrate deploy can re-apply them.
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
