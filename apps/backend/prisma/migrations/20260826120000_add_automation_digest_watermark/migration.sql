-- AddColumn: Automation.lastDigestedAt
-- Explicit digest watermark for schedule automations, replacing the previous
-- "most recent COMPLETED run" derivation (which a test run or a partially-delivered
-- batch could advance past responses that were never actually processed).
-- IF NOT EXISTS: dev environments may already have this column via `prisma db push`.
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "lastDigestedAt" TIMESTAMP(3);

-- Backfill for automations that are already live: adopt the previous semantics
-- (the most recent COMPLETED run's start time) so an existing schedule automation
-- keeps its current window instead of re-processing its whole response history on
-- the first tick after this deploy. Automations with no completed run stay NULL.
UPDATE "automation" a
SET "lastDigestedAt" = r."startedAt"
FROM (
    SELECT DISTINCT ON ("automationId") "automationId", "startedAt"
    FROM "automation_run"
    WHERE "status" = 'COMPLETED'
    ORDER BY "automationId", "startedAt" DESC
) r
WHERE r."automationId" = a."id"
  AND a."triggerType" = 'schedule'
  AND a."lastDigestedAt" IS NULL;
