-- S14-01: deleting a user must never cascade to the forms (and all their responses) they created.
-- Switch form.createdById from ON DELETE CASCADE to ON DELETE RESTRICT.
ALTER TABLE "form" DROP CONSTRAINT IF EXISTS "form_createdById_fkey";
ALTER TABLE "form" ADD CONSTRAINT "form_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
