import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

/**
 * Safe migration runner for CI and production deployments.
 *
 * Handles three cases automatically:
 *
 * 1. Existing database (no migration history at all) — detects this by
 *    checking for the `_prisma_migrations` table. Resolves ALL known
 *    migrations as "already applied" so Prisma does not try to re-create
 *    tables/indexes that already exist, then runs `migrate deploy` to apply
 *    only genuinely new migrations.
 *
 * 2. Existing database with partial migration history — a previous migration
 *    run failed with "already exists" (error codes 42P07 / 42701), leaving
 *    entries with no finished_at. These are resolved as --applied (not
 *    --rolled-back) because the effect is already in the DB.
 *
 * 3. Fresh database — `_prisma_migrations` absent AND no schema. Runs
 *    `migrate deploy` directly so all migrations are applied from scratch.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

// PostgreSQL error codes that mean the object already exists in the DB.
// The migration effect is already present — safe to mark as applied.
const ALREADY_EXISTS_CODES = ['42P07', '42701'];

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
      console.log('Migration history found. Checking for failed migrations...');

      const failedMigrations = await prisma.$queryRaw<Array<{ migration_name: string; logs: string | null }>>`
        SELECT migration_name, logs FROM _prisma_migrations
        WHERE started_at IS NOT NULL
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
      `;

      for (const { migration_name, logs } of failedMigrations) {
        const isAlreadyExists = ALREADY_EXISTS_CODES.some(code => logs?.includes(code));

        if (isAlreadyExists) {
          // The column/index already exists — the migration's intent is satisfied.
          // Resolve as applied so migrate deploy skips it cleanly.
          console.log(`Migration ${migration_name} failed with "already exists" — resolving as applied.`);
          execSync(`npx prisma migrate resolve --applied ${migration_name}`, { stdio: 'inherit' });
        } else {
          // Genuine failure — resolve as rolled-back so migrate deploy re-applies it.
          console.log(`Migration ${migration_name} failed — resolving as rolled-back to re-apply.`);
          execSync(`npx prisma migrate resolve --rolled-back ${migration_name}`, { stdio: 'inherit' });
        }
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
