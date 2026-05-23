-- Add response tags support (idempotent — tables may already exist on production)
CREATE TABLE IF NOT EXISTS "response_tag" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "response_tag_assignment" (
    "responseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_tag_assignment_pkey" PRIMARY KEY ("responseId","tagId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "response_tag_formId_name_key" ON "response_tag"("formId", "name");
CREATE INDEX IF NOT EXISTS "response_tag_formId_idx" ON "response_tag"("formId");
CREATE INDEX IF NOT EXISTS "response_tag_assignment_tagId_idx" ON "response_tag_assignment"("tagId");

ALTER TABLE "response_tag" ADD CONSTRAINT IF NOT EXISTS "response_tag_formId_fkey" FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "response_tag_assignment" ADD CONSTRAINT IF NOT EXISTS "response_tag_assignment_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "response_tag_assignment" ADD CONSTRAINT IF NOT EXISTS "response_tag_assignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "response_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
