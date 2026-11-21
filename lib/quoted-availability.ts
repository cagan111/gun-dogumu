/** Pure staff-specific quote planner. Production activation is a separate, coordinated cutover. */
import { computeAvailability, type AvailabilityInput, type StaffAvailabilityInput } from './availability';
import { effectiveServiceTerms } from './service-terms';
import { makeServiceQuote, type ServiceQuote } from './service-quote';
type Sources = Parameters<typeof effectiveServiceTerms>;
export interface QuotedAvailabilityInput extends Omit<AvailabilityInput, 'service' | 'staff'> {
  service: Sources[0];
  /** Input order is the stable tie-break order for offers at the same instant. */
  people: { staff: Sources[1]; link: Sources[2]; availability: StaffAvailabilityInput }[];
}
export interface QuotedSlot { start: Date; staffIds: string[]; offers: ServiceQuote[] }
export function computeQuotedAvailability(input: QuotedAvailabilityInput): QuotedSlot[] {
  const found = new Map<number, QuotedSlot>();
  const seen = new Set<string>();
  for (const person of input.people) {
    const id = person.staff.id;
    if (seen.has(id) || person.availability.id !== id) throw new Error('invalid_quote_staff');
    seen.add(id);
    const terms = effectiveServiceTerms(input.service, person.staff, person.link);
    const slots = computeAvailability({ tenant: input.tenant, service: terms, staff: [person.availability], busy: input.busy, date: input.date, now: input.now });
    for (const slot of slots) {
      const instant = slot.start.getTime();
      let combined = found.get(instant);
      if (!combined) { combined = { start: new Date(instant), staffIds: [], offers: [] }; found.set(instant, combined); }
      combined.staffIds.push(id);
      combined.offers.push(makeServiceQuote(input.service.id, id, slot.start, terms));
    }
  }
  return [...found.entries()].sort(([a], [b]) => a - b).map(([, slot]) => slot);
}
