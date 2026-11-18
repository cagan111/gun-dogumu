-- Önceki OTP kayıtları bütçe sürümünden önce olduğundan 0 rezervasyon taşır.
ALTER TABLE "Otp" ADD COLUMN "reservedSegments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_reservedSegments_nonnegative" CHECK ("reservedSegments" >= 0);
CREATE INDEX "Otp_tenantId_createdAt_idx" ON "Otp"("tenantId", "createdAt");
