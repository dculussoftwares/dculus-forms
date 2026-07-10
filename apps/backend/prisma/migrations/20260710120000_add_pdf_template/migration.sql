-- CreateTable
CREATE TABLE "pdf_template" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" JSONB NOT NULL,
    "fileKey" TEXT,
    "fileName" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_template_formId_idx" ON "pdf_template"("formId");

-- AddForeignKey
ALTER TABLE "pdf_template" ADD CONSTRAINT "pdf_template_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
