-- Public template pages: SEO title/keywords, gallery tags, long-form copy, photo credit, ordering.
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "content" JSONB;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "imageCredit" JSONB;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
