-- CreateTable: OrganizationBrandKit (org-level saved design tokens)
-- IF NOT EXISTS: dev environments may already have this table via `prisma db push`
CREATE TABLE IF NOT EXISTS "organization_brand_kit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tokens" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_brand_kit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "organization_brand_kit_organizationId_key" ON "organization_brand_kit"("organizationId");

-- AddForeignKey (idempotent — silently skips if constraint already exists)
DO $$ BEGIN
  ALTER TABLE "organization_brand_kit" ADD CONSTRAINT "organization_brand_kit_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
