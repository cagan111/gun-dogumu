CREATE TYPE "ReviewInvitationStatus" AS ENUM ('pending', 'processing', 'finished', 'skipped');
CREATE TABLE "ReviewInvitation" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "appointmentId" TEXT NOT NULL, "customerId" TEXT NOT NULL,
 "recipient" VARCHAR(32) NOT NULL, "reviewUrl" VARCHAR(500) NOT NULL,
 "completedAt" TIMESTAMP(3) NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "status" "ReviewInvitationStatus" NOT NULL DEFAULT 'pending', "messageId" TEXT, "finishedReason" VARCHAR(64),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ReviewInvitation_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReviewInvitation_time_order" CHECK ("dueAt" > "completedAt" AND "expiresAt" > "dueAt")
);
CREATE UNIQUE INDEX "ReviewInvitation_appointmentId_key" ON "ReviewInvitation"("appointmentId");
CREATE UNIQUE INDEX "ReviewInvitation_messageId_key" ON "ReviewInvitation"("messageId");
CREATE INDEX "ReviewInvitation_status_dueAt_idx" ON "ReviewInvitation"("status", "dueAt");
CREATE INDEX "ReviewInvitation_tenantId_status_idx" ON "ReviewInvitation"("tenantId", "status");
ALTER TABLE "ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
