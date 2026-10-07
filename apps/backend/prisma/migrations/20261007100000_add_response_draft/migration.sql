-- CreateTable
-- IF NOT EXISTS: dev environments may already have this table via `prisma db push`
CREATE TABLE IF NOT EXISTS "response_draft" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "currentPageId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "response_draft_formId_userId_key" ON "response_draft"("formId", "userId");
CREATE INDEX IF NOT EXISTS "response_draft_userId_idx" ON "response_draft"("userId");
CREATE INDEX IF NOT EXISTS "response_draft_expiresAt_idx" ON "response_draft"("expiresAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "response_draft" ADD CONSTRAINT "response_draft_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "response_draft" ADD CONSTRAINT "response_draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
