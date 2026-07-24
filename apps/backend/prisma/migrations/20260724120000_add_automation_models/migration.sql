-- CreateTable: Automation
-- IF NOT EXISTS: dev environments may already have these tables via `prisma db push`
CREATE TABLE IF NOT EXISTS "automation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB,
    "graph" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AutomationRun
CREATE TABLE IF NOT EXISTS "automation_run" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "responseId" TEXT,
    "automationVersion" INTEGER NOT NULL,
    "graphSnapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "context" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "automation_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AutomationStepRun
CREATE TABLE IF NOT EXISTS "automation_step_run" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "automation_step_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_formId_idx" ON "automation"("formId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_organizationId_idx" ON "automation"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_formId_status_idx" ON "automation"("formId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_run_automationId_idx" ON "automation_run"("automationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_run_responseId_idx" ON "automation_run"("responseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_run_status_idx" ON "automation_run"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_run_automationId_startedAt_idx" ON "automation_run"("automationId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_step_run_runId_idx" ON "automation_step_run"("runId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "automation_step_run_runId_nodeId_idx" ON "automation_step_run"("runId", "nodeId");

-- AddForeignKey (idempotent — silently skips if constraint already exists)
DO $$ BEGIN
  ALTER TABLE "automation" ADD CONSTRAINT "automation_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_automationId_fkey"
    FOREIGN KEY ("automationId") REFERENCES "automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "automation_step_run" ADD CONSTRAINT "automation_step_run_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "automation_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
