-- AddColumns: Form Embed v1 traffic-source attribution
-- Records where a view/submission came from: the hosted page ('direct') or one of the
-- embed contexts, plus the host page's hostname.
--
-- embedHost stores the HOSTNAME ONLY, never the full parent URL — a parent URL's query
-- string can carry PII, a hostname cannot. See docs/form-embed-v1-spec.md §8.
--
-- Both columns are nullable with no default: existing rows stay NULL and read as 'direct'
-- at the query layer, so no backfill is needed and no existing analytics figure moves.
-- IF NOT EXISTS: dev environments may already have these columns via `prisma db push`.
ALTER TABLE "form_view_analytics" ADD COLUMN IF NOT EXISTS "embedContext" TEXT;
ALTER TABLE "form_view_analytics" ADD COLUMN IF NOT EXISTS "embedHost" TEXT;

ALTER TABLE "form_submission_analytics" ADD COLUMN IF NOT EXISTS "embedContext" TEXT;
ALTER TABLE "form_submission_analytics" ADD COLUMN IF NOT EXISTS "embedHost" TEXT;

-- Supports the analytics traffic-source breakdown ("which sites embed this form"),
-- which groups by embedHost within a single form.
CREATE INDEX IF NOT EXISTS "form_view_analytics_formId_embedHost_idx"
    ON "form_view_analytics" ("formId", "embedHost");
CREATE INDEX IF NOT EXISTS "form_submission_analytics_formId_embedHost_idx"
    ON "form_submission_analytics" ("formId", "embedHost");
