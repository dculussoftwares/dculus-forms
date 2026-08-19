-- CreateTable: ResponseGrade
-- IF NOT EXISTS: dev environments may already have this table via `prisma db push`
CREATE TABLE IF NOT EXISTS "response_grade" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "autoScore" DOUBLE PRECISION NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedById" TEXT,
    "releasedAt" TIMESTAMP(3),
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "detail" JSONB NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "integrity" JSONB,

    CONSTRAINT "response_grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "response_grade_responseId_key" ON "response_grade"("responseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "response_grade_formId_idx" ON "response_grade"("formId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "response_grade_formId_percentage_idx" ON "response_grade"("formId", "percentage");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "response_grade_formId_status_idx" ON "response_grade"("formId", "status");

-- AddForeignKey (idempotent — silently skips if constraint already exists)
DO $$ BEGIN
  ALTER TABLE "response_grade" ADD CONSTRAINT "response_grade_responseId_fkey"
    FOREIGN KEY ("responseId") REFERENCES "response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
