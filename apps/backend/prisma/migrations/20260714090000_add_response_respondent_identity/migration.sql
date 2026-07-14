-- AlterTable
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`
ALTER TABLE "response" ADD COLUMN IF NOT EXISTS "respondentUserId" TEXT;
ALTER TABLE "response" ADD COLUMN IF NOT EXISTS "respondentEmail" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "response_respondentUserId_idx" ON "response"("respondentUserId");
