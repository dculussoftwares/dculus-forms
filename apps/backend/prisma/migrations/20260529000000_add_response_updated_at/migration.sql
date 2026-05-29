-- Add missing updatedAt column to response table.
-- This column was added to the Prisma schema before the migration system was
-- introduced, so the init migration was resolved as baseline on existing
-- production databases without actually creating the column.
ALTER TABLE "response" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "response" SET "updatedAt" = "submittedAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "response" ALTER COLUMN "updatedAt" SET NOT NULL;
