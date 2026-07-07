-- AlterTable
-- IF NOT EXISTS: dev environments already received these columns via `prisma db push`
ALTER TABLE "ai_usage" ADD COLUMN IF NOT EXISTS "creditsUsedMilli" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "aiCreditsLimit" INTEGER;
