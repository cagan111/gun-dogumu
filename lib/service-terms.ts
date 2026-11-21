/** Pure, shared T124 contract. Booking/UI activation is a separate delivery. */
type Money = string | number | { toString(): string };
type ServiceTerms = { id: string; tenantId: string; durationMin: number; bufferMin: number; priceTry: Money };
type StaffTerms = { id: string; tenantId: string };
type EligibilityTerms = { tenantId: string; serviceId: string; staffId: string; durationMinOverride: number | null; priceTryOverride: Money | null };

function invalid(): never { throw new Error("invalid_service_terms"); }
/** Decimal text avoids a floating-point price/rounding contract in clients. */
function price(value: Money): string {
  const text = String(value);
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(text)) invalid();
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (cents > 10_000_000) invalid();
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
/** Eligibility must match all three scoped records; this is not a replacement for scoped DB reads. */
export function effectiveServiceTerms(service: ServiceTerms, staff: StaffTerms, link: EligibilityTerms) {
  if (!service.tenantId || staff.tenantId !== service.tenantId || link.tenantId !== service.tenantId || link.serviceId !== service.id || link.staffId !== staff.id) invalid();
  const durationMin = link.durationMinOverride ?? service.durationMin;
  if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 600) invalid();
  if (!Number.isInteger(service.bufferMin) || service.bufferMin < 0 || service.bufferMin > 240) invalid();
  return { durationMin, bufferMin: service.bufferMin, priceTry: price(link.priceTryOverride ?? service.priceTry) };
}
