-- Migration: ai_sdk_uimessage_storage
-- Adds UIMessage data column to ai_chat_message (replaces operations)
-- Converts AIUsage index to unique constraint for single-upsert pattern

-- Step 1: Add data column (nullable initially for safe backfill)
ALTER TABLE "ai_chat_message" ADD COLUMN IF NOT EXISTS "data" JSONB;

-- Step 2: Backfill data column from existing role + content
UPDATE "ai_chat_message"
SET data = jsonb_build_object(
  'id', id,
  'role', role,
  'content', content,
  'createdAt', "createdAt",
  'parts', jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', content)
  )
)
WHERE data IS NULL;

-- Step 3: Make data column NOT NULL now that all rows are backfilled
ALTER TABLE "ai_chat_message" ALTER COLUMN "data" SET NOT NULL;

-- Step 4: Drop operations column (tool invocations now embedded in UIMessage parts)
ALTER TABLE "ai_chat_message" DROP COLUMN IF EXISTS "operations";

-- Step 5: Convert AIUsage index to unique constraint
DROP INDEX IF EXISTS "ai_usage_organizationId_periodStart_idx";

DO $$ BEGIN
  ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_organizationId_periodStart_key"
    UNIQUE ("organizationId", "periodStart");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
