-- Add email usage tracking (emailsUsed/emailsLimit), the 4th usage metric alongside
-- viewsUsed/submissionsUsed/aiCreditsLimit.
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "emailsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "emailsLimit" INTEGER;
