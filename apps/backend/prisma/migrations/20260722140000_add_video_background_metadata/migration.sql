-- AlterTable
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`
ALTER TABLE "form_metadata" ADD COLUMN IF NOT EXISTS "backgroundVideoKey" TEXT;
ALTER TABLE "form_metadata" ADD COLUMN IF NOT EXISTS "backgroundDominantColor" TEXT;
