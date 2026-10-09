-- CreateTable: background jobs for "download respondent files as a ZIP".
CREATE TABLE IF NOT EXISTS "response_file_export" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "grouping" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "fileKey" TEXT,
    "filename" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "response_file_export_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "response_file_export_formId_idx" ON "response_file_export"("formId");
CREATE INDEX IF NOT EXISTS "response_file_export_requestedById_createdAt_idx" ON "response_file_export"("requestedById", "createdAt");

DO $$ BEGIN
  ALTER TABLE "response_file_export" ADD CONSTRAINT "response_file_export_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "response_file_export" ADD CONSTRAINT "response_file_export_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- At most one running export per person and form. Concurrent requests that lose
-- the race resume the running job instead of starting another. Partial unique
-- indexes can't be expressed in schema.prisma, so it lives only in this migration.
CREATE UNIQUE INDEX IF NOT EXISTS "response_file_export_one_running_idx"
  ON "response_file_export"("formId", "requestedById")
  WHERE "status" = 'running';
