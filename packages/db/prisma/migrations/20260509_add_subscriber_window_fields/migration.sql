-- Add subscription window fields for SUBSCRIBER role lifecycle
ALTER TABLE "JournalRoleAssignment"
  ADD COLUMN IF NOT EXISTS "subscriptionStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionEndAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JournalRoleAssignment_role_subscriptionEndAt_idx"
  ON "JournalRoleAssignment"("role", "subscriptionEndAt");
