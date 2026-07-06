-- AlterTable
ALTER TABLE "plugin_delivery" ADD COLUMN     "responseId" TEXT;

-- CreateTable
CREATE TABLE "plugin_backfill_job" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "plugin_backfill_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plugin_backfill_job_pluginId_idx" ON "plugin_backfill_job"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_backfill_job_formId_idx" ON "plugin_backfill_job"("formId");

-- CreateIndex
CREATE INDEX "plugin_delivery_pluginId_responseId_idx" ON "plugin_delivery"("pluginId", "responseId");

-- AddForeignKey
ALTER TABLE "plugin_backfill_job" ADD CONSTRAINT "plugin_backfill_job_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "form_plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
