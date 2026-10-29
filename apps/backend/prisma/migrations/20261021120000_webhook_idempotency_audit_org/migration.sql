-- S12-04: Chargebee webhook idempotency + ordering.
CREATE TABLE IF NOT EXISTS "processed_webhook_event" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_webhook_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "processed_webhook_event_processedAt_idx" ON "processed_webhook_event"("processedAt");

ALTER TABLE "subscription" ADD COLUMN IF NOT EXISTS "lastWebhookEventAt" TIMESTAMP(3);

-- S14-04: tenant scope on audit rows (no FK — audit rows must outlive the organization).
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
CREATE INDEX IF NOT EXISTS "audit_log_organizationId_createdAt_idx" ON "audit_log"("organizationId", "createdAt");
