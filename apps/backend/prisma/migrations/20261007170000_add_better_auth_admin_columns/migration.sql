-- AddColumns: fields the better-auth admin plugin reads and writes (ban reason/expiry,
-- impersonation). better-auth >= 1.7.7 validates the schema at startup and refuses to
-- boot without them.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
