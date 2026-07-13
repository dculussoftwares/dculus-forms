-- AlterTable
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`
ALTER TABLE "pdf_generator" ADD COLUMN IF NOT EXISTS "columnName" TEXT;
ALTER TABLE "pdf_generator" ADD COLUMN IF NOT EXISTS "filenameFieldId" TEXT;
