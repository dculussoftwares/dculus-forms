-- AlterTable
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "enterpriseCurrency" TEXT;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "enterprisePeriod" TEXT;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "enterprisePriceInSmallestUnit" INTEGER;
ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "enterprisePendingActivation" BOOLEAN NOT NULL DEFAULT false;
