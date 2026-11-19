ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT,
 ADD COLUMN "requestHash" TEXT,
 ADD COLUMN "appliedPlan" TEXT,
 ADD COLUMN "appliedEndsAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");
