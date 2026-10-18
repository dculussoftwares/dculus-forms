-- Automation autosave: a working copy (draft) kept separate from the published graph.
-- `graph` / `triggerConfig` / `version` keep meaning "published"; a NULL draft means no unpublished changes.
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftGraph" JSONB;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftTriggerConfig" JSONB;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftUpdatedAt" TIMESTAMP(3);
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftUpdatedById" TEXT;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "draftIssueCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "publishedById" TEXT;

-- Existing live automations were last "published" when they were last saved.
UPDATE "automation" SET "publishedAt" = "updatedAt" WHERE "status" IN ('ACTIVE', 'PAUSED') AND "publishedAt" IS NULL;
