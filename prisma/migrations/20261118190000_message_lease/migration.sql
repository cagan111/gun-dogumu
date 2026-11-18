ALTER TABLE "MessageLog" ADD COLUMN "leaseOwner" TEXT, ADD COLUMN "leaseUntil" TIMESTAMP(3), ADD COLUMN "dispatchStartedAt" TIMESTAMP(3);
CREATE INDEX "MessageLog_status_leaseUntil_idx" ON "MessageLog"("status", "leaseUntil");
