-- Public template gallery (dculus.com/forms/templates): slug, visibility, SEO and thumbnail.
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;
ALTER TABLE "form_template" ADD COLUMN IF NOT EXISTS "thumbnailAlt" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "form_template_slug_key" ON "form_template"("slug");
CREATE INDEX IF NOT EXISTS "form_template_isPublic_isActive_idx" ON "form_template"("isPublic", "isActive");
