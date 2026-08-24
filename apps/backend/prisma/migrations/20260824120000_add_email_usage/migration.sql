-- Add email usage tracking (emailsUsed/emailsLimit), the 4th usage metric alongside
-- viewsUsed/submissionsUsed/aiCreditsLimit.
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "emailsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "emailsLimit" INTEGER;

-- Backfill existing rows so they start hard-enforced at the same defaults as
-- PLAN_LIMITS_FALLBACK (apps/backend/src/lib/planLimits.ts), instead of
-- silently landing on NULL (= unlimited) until an admin re-saves the plan
-- catalog. Enterprise (and any custom/unknown plan) is left NULL — enterprise
-- limits are always admin-set directly, never catalog-derived.
UPDATE "subscription" SET "emailsLimit" = CASE "planId"
  WHEN 'free' THEN 100
  WHEN 'starter' THEN 5000
  WHEN 'advanced' THEN 50000
  ELSE NULL
END
WHERE "emailsLimit" IS NULL;
