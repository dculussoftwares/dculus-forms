-- P4-02: Add GIN index on FormPlugin.events for efficient ANY() lookups
-- B-tree indexes cannot accelerate "WHERE 'form.submitted' = ANY(events)" on array columns.
-- GIN (Generalized Inverted Index) indexes array elements individually, making event-based
-- plugin queries fast even with large plugin tables.
CREATE INDEX IF NOT EXISTS form_plugin_events_gin ON "form_plugin" USING GIN(events);
