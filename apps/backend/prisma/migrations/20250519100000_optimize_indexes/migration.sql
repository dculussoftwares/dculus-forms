-- ============================================================
-- Index optimisation for form-submission workload
--
-- Rationale per table:
--
-- response:
--   GIN indexes on `data` and `metadata` are write-only overhead.
--   All filter queries use data->>'fieldId' with LOWER/ILIKE/CAST
--   expressions that a jsonb_ops GIN index cannot serve.
--   Dropping them cuts index maintenance cost on every INSERT.
--
-- form_view_analytics / form_submission_analytics:
--   Every analytics query is WHERE formId = ? AND <time> BETWEEN ? AND ?
--   Separate [formId] and [viewedAt/submittedAt] indexes force an index
--   merge or table filter.  A single composite replaces both and serves
--   all groupBy analytics queries in one seek.
--   sessionId is only ever in a GROUP BY clause, never in WHERE —
--   its standalone index provided zero selectivity benefit.
--   completionTimeSeconds is always aggregated scoped to a formId —
--   a standalone index on it is never chosen by the planner.
--
-- response_field_change:
--   changeType has only 3 values (ADD/UPDATE/DELETE); a B-tree index
--   with such low cardinality is skipped by the planner in favour of
--   a seq-scan and just adds write overhead.
-- ============================================================

-- Drop unused GIN indexes on response (write overhead, never read)
DROP INDEX IF EXISTS "response_data_idx";
DROP INDEX IF EXISTS "response_metadata_idx";

-- Replace three separate indexes on form_view_analytics with one composite
DROP INDEX IF EXISTS "form_view_analytics_formId_idx";
DROP INDEX IF EXISTS "form_view_analytics_viewedAt_idx";
DROP INDEX IF EXISTS "form_view_analytics_sessionId_idx";
CREATE INDEX "form_view_analytics_formId_viewedAt_idx" ON "form_view_analytics"("formId", "viewedAt");

-- Replace four separate indexes on form_submission_analytics with one composite
DROP INDEX IF EXISTS "form_submission_analytics_formId_idx";
DROP INDEX IF EXISTS "form_submission_analytics_submittedAt_idx";
DROP INDEX IF EXISTS "form_submission_analytics_sessionId_idx";
DROP INDEX IF EXISTS "form_submission_analytics_completionTimeSeconds_idx";
CREATE INDEX "form_submission_analytics_formId_submittedAt_idx" ON "form_submission_analytics"("formId", "submittedAt");

-- Drop low-cardinality index on response_field_change
DROP INDEX IF EXISTS "response_field_change_changeType_idx";
