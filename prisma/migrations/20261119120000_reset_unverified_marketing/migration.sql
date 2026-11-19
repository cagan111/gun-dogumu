-- Earlier anonymous booking could manufacture opt-in; no verified evidence exists for those flags.
-- Deploy with the new application/worker together; do not run old booking code after this reset.
BEGIN;
INSERT INTO "AuditLog" ("id", "actorRole", "tenantId", "action", "details")
SELECT 'consent-legacy-reset:' || "id", 'system', "tenantId", 'customer.marketing_consent',
 jsonb_build_object('customerId', "id", 'enabled', false, 'source', 'legacy_unverified_reset')
FROM "Customer" WHERE "marketingConsent" = true;
UPDATE "Customer" SET "marketingConsent" = false, "marketingConsentAt" = NULL WHERE "marketingConsent" = true;
COMMIT;
