-- Additive only: existing eligibility links retain both NULL defaults.
ALTER TABLE "ServiceStaff"
  ADD COLUMN "durationMinOverride" INTEGER,
  ADD COLUMN "priceTryOverride" DECIMAL(10,2),
  ADD CONSTRAINT "service_staff_duration_override_range" CHECK ("durationMinOverride" IS NULL OR "durationMinOverride" BETWEEN 5 AND 600),
  ADD CONSTRAINT "service_staff_price_override_range" CHECK ("priceTryOverride" IS NULL OR "priceTryOverride" BETWEEN 0 AND 100000);
