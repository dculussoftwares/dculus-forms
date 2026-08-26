-- AddColumn: Automation.lastDigestedAt
-- Explicit digest watermark for schedule automations, replacing the previous
-- "most recent COMPLETED run" derivation (which a test run or a partially-delivered
-- batch could advance past responses that were never actually processed).
-- IF NOT EXISTS: dev environments may already have this column via `prisma db push`.
ALTER TABLE "automation" ADD COLUMN IF NOT EXISTS "lastDigestedAt" TIMESTAMP(3);

-- Backfill for automations that are already live: adopt the previous semantics
-- (the most recent COMPLETED run's start time) so an existing schedule automation
-- keeps its current window instead of re-processing its whole response history on
-- the first tick after this deploy.
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

-- Second pass, and the one that actually prevents an incident: an ACTIVE schedule
-- automation that has never completed a run (activated but not yet fired, or every
-- run so far failed) has no run to adopt a watermark from. Left NULL it would be
-- read as "cover the whole form history" and its first tick after this deploy would
-- process — and, with a per-response email action, email — every response the form
-- has ever received.
--
-- These automations never pass through setAutomationStatus again, so activation
-- cannot seed them; the migration is the only chance. Anchoring on deploy time skips
-- responses submitted between activation and this deploy, which is the deliberate
-- trade: skipping a bounded window is recoverable, an unannounced mass send is not.
-- DRAFT/PAUSED automations are left NULL on purpose — they get their watermark from
-- setAutomationStatus when they are next activated, which is also where an
-- includeExistingResponses opt-in is honoured.
UPDATE "automation"
SET "lastDigestedAt" = NOW()
WHERE "triggerType" = 'schedule'
  AND "status" = 'ACTIVE'
  AND "lastDigestedAt" IS NULL
  AND "graph" -> 'nodes' @> '[{"type": "digest"}]';
