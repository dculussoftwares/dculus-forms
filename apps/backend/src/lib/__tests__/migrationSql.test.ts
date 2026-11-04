import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { isRerunnableMigration } from '../migrationSql.js';

describe('isRerunnableMigration', () => {
  it('is true only when every statement is guarded', () => {
    expect(isRerunnableMigration('-- note; with a semicolon\nALTER TABLE "t" ADD COLUMN IF NOT EXISTS "a" TEXT;\nCREATE INDEX IF NOT EXISTS "i" ON "t"("a");')).toBe(true);
    expect(isRerunnableMigration('ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "a" TEXT;\nALTER TABLE "t" DROP COLUMN "b";')).toBe(false);
    expect(isRerunnableMigration('')).toBe(false);
  });

  it('treats the template SEO migration as re-runnable', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../../prisma/migrations/20261104120000_template_seo_content/migration.sql'),
      'utf8'
    );
    expect(isRerunnableMigration(sql)).toBe(true);
  });
});
