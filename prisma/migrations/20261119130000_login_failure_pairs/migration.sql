CREATE TABLE "LoginFailure" (
 "key" TEXT PRIMARY KEY,
 "failedCount" INTEGER NOT NULL DEFAULT 0 CHECK ("failedCount" >= 0 AND "failedCount" <= 8),
 "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSuccessAt" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "LoginFailure_updatedAt_idx" ON "LoginFailure"("updatedAt");
