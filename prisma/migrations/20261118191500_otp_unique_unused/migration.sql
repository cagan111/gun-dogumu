BEGIN;
-- Prevent old app writers inserting between cleanup and index creation.
LOCK TABLE "Otp" IN SHARE ROW EXCLUSIVE MODE;
WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "tenantId", "phone" ORDER BY "createdAt" DESC, "id" DESC
  ) AS rn FROM "Otp" WHERE "usedAt" IS NULL
)
UPDATE "Otp" o SET "usedAt" = CURRENT_TIMESTAMP
FROM ranked r WHERE o."id" = r."id" AND r.rn > 1;
CREATE UNIQUE INDEX "Otp_one_unused_per_tenant_phone_idx"
ON "Otp" ("tenantId", "phone") WHERE "usedAt" IS NULL;
COMMIT;
