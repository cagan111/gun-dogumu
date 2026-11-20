ALTER TABLE "Tenant" ADD COLUMN "reviewInviteEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewInviteUrl" VARCHAR(500);
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_reviewInviteUrl_required" CHECK (NOT "reviewInviteEnabled" OR "reviewInviteUrl" IS NOT NULL);
ALTER TABLE "Appointment" ADD COLUMN "completedAt" TIMESTAMP(3);
-- No legacy completion-time guess/backfill and no SMS/queue backfill.
