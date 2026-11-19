ALTER TABLE "Tenant" ADD COLUMN "smsAllowedCallingCodes" TEXT[] NOT NULL DEFAULT ARRAY['90']::TEXT[], ADD COLUMN "smsDailySegmentLimit" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_smsDailySegmentLimit_range" CHECK ("smsDailySegmentLimit" BETWEEN 1 AND 2000);
ALTER TABLE "MessageLog" ADD COLUMN "smsSafetySegments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_smsSafetySegments_nonnegative" CHECK ("smsSafetySegments" >= 0);
CREATE INDEX "MessageLog_recipient_createdAt_idx" ON "MessageLog"("recipient", "createdAt");
-- Conservatively count all current UTC-day legacy SMS attempts, even old refunded/failed rows.
UPDATE "MessageLog" SET "smsSafetySegments" = GREATEST("cost", 1)
WHERE "channel" = 'sms' AND "createdAt" >= date_trunc('day', now() AT TIME ZONE 'UTC');
