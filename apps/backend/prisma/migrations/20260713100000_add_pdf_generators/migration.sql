-- CreateTable
CREATE TABLE "pdf_generator" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "filterLogic" TEXT NOT NULL DEFAULT 'AND',
    "autoRunOnSubmit" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_generator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_generation_run" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "succeededCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "pdf_generation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_generation_result" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileKey" TEXT,
    "filename" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_generation_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_generator_formId_idx" ON "pdf_generator"("formId");

-- CreateIndex
CREATE INDEX "pdf_generator_templateId_idx" ON "pdf_generator"("templateId");

-- CreateIndex
CREATE INDEX "pdf_generation_run_generatorId_idx" ON "pdf_generation_run"("generatorId");

-- CreateIndex
CREATE INDEX "pdf_generation_result_generatorId_idx" ON "pdf_generation_result"("generatorId");

-- CreateIndex
CREATE INDEX "pdf_generation_result_responseId_idx" ON "pdf_generation_result"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_generation_result_generatorId_responseId_key" ON "pdf_generation_result"("generatorId", "responseId");

-- AddForeignKey
ALTER TABLE "pdf_generator" ADD CONSTRAINT "pdf_generator_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_generator" ADD CONSTRAINT "pdf_generator_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "pdf_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_generation_run" ADD CONSTRAINT "pdf_generation_run_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "pdf_generator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_generation_result" ADD CONSTRAINT "pdf_generation_result_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "pdf_generator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
