-- AlterTable: Add soft delete (deletedAt) to Form
ALTER TABLE "form" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Add soft delete (deletedAt) to Response
ALTER TABLE "response" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex: Index on form.deletedAt for efficient soft-delete filtering
CREATE INDEX "form_deletedAt_idx" ON "form"("deletedAt");

-- CreateIndex: Index on response.deletedAt for efficient soft-delete filtering
CREATE INDEX "response_deletedAt_idx" ON "response"("deletedAt");
