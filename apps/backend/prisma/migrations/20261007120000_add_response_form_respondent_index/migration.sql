-- Serves the per-respondent lookups behind "one response per person",
-- Form.myResponse and editMyResponse.
CREATE INDEX IF NOT EXISTS "response_formId_respondentUserId_idx" ON "response"("formId", "respondentUserId");
