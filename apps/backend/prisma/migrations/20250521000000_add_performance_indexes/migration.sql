-- ============================================================
-- P1-14: Add missing performance indexes
--
-- Rationale:
--
-- form_view_analytics / form_submission_analytics — sessionId composite:
--   Analytics deduplication queries join or group by (formId, sessionId)
--   to count unique visitors.  Without a covering index the planner
--   must scan all rows for a given formId and then sort by sessionId
--   in memory.  Adding (formId, sessionId) lets these lookups be served
--   entirely from the index.
--
-- form — (organizationId, createdById) composite:
--   The responses resolver fetches all forms for an org scoped to a
--   specific creator (WHERE organizationId = ? AND createdById = ?).
--   The existing single-column organizationId index is used for the
--   first predicate but then requires a heap fetch + filter for
--   createdById.  The composite index covers both predicates in one seek.
--
-- response — GIN index on data (jsonb_path_ops):
--   Field-level filter queries on response.data use JSON path expressions
--   (e.g.  data @> '{"fieldId": "value"}').  jsonb_path_ops is the
--   narrow operator class that covers @> and @? operators, making it
--   smaller and faster than the default jsonb_ops for path-containment
--   queries.  Cannot be expressed in Prisma schema DSL so it is added
--   here as raw SQL.
-- ============================================================

-- Composite index for analytics deduplication by session within a form
CREATE INDEX IF NOT EXISTS "form_view_analytics_formId_sessionId_idx"
  ON "form_view_analytics"("formId", "sessionId");

CREATE INDEX IF NOT EXISTS "form_submission_analytics_formId_sessionId_idx"
  ON "form_submission_analytics"("formId", "sessionId");

-- Composite index for form queries filtered by org and creator
CREATE INDEX IF NOT EXISTS "form_organizationId_createdById_idx"
  ON "form"("organizationId", "createdById");

-- GIN index on response.data for JSON path-containment queries
-- Uses jsonb_path_ops (smaller, faster for @> and @? operators)
CREATE INDEX IF NOT EXISTS "response_data_gin_idx"
  ON "response" USING GIN (data jsonb_path_ops);
