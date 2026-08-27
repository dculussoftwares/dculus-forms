-- AddColumns: Automation run-health tracking
-- Denormalised outcome of the most recent run, so the automations list can badge a broken
-- automation without scanning its run history, plus the failure streak that drives the
-- first-failure notification and auto-pause.
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`.
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "lastRunStatus" TEXT;
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "lastRunAt" TIMESTAMP(3);
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill the last-run columns from existing history so an automation that is already broken
-- badges immediately, rather than looking healthy until it next fires. The failure streak is
-- deliberately left at 0: it gates notifications, and replaying a streak that built up before
-- this feature existed would email people about failures they have long since seen or forgotten.
UPDATE "automation" a
SET "lastRunStatus" = r."status",
    "lastRunAt" = r."startedAt"
FROM (
    SELECT DISTINCT ON ("automationId") "automationId", "status", "startedAt"
    FROM "automation_run"
    ORDER BY "automationId", "startedAt" DESC
) r
WHERE r."automationId" = a."id"
  AND a."lastRunStatus" IS NULL;
