/** Client-confirmed quote is an expectation, not an authorization token or slot hold. */
import { z } from "zod";
import { effectiveServiceTerms, servicePriceText } from "./service-terms";
// Zod object construction probes eval unless JIT is disabled before construction.
// Browser CSP forbids eval; server validation keeps its existing configuration.
if (typeof window !== "undefined") z.config({ jitless: true });
export const serviceQuoteSchema = z.object({
  serviceId: z.string().min(1).max(64), staffId: z.string().min(1).max(64).refine(v => v !== "any"),
  startsAt: z.string().datetime({ offset: true }).transform(v => new Date(v).toISOString()),
  durationMin: z.number().int().min(5).max(600), bufferMin: z.number().int().min(0).max(240),
  priceTry: z.string().max(12).refine(v => { try { return servicePriceText(v) === v; } catch { return false; } }),
}).strict();
export type ServiceQuote = z.output<typeof serviceQuoteSchema>;
type Terms = ReturnType<typeof effectiveServiceTerms>;
/** Temporary activation gate: do not offer/apply differing staff terms before all consumers are ready. */
export function baseQuoteTerms(...args: Parameters<typeof effectiveServiceTerms>): Terms | null {
  const terms = effectiveServiceTerms(...args);
  return terms.durationMin === args[0].durationMin && terms.priceTry === servicePriceText(args[0].priceTry) ? terms : null;
}
export function makeServiceQuote(serviceId: string, staffId: string, startsAt: Date, terms: Terms): ServiceQuote {
  return { serviceId, staffId, startsAt: startsAt.toISOString(), ...terms };
}
export function matchesServiceQuote(expected: unknown, actual: ServiceQuote): boolean {
  const parsed = serviceQuoteSchema.safeParse(expected);
  if (!parsed.success) return false;
  const q = parsed.data;
  return q.serviceId === actual.serviceId && q.staffId === actual.staffId && q.startsAt === actual.startsAt && q.durationMin === actual.durationMin && q.bufferMin === actual.bufferMin && q.priceTry === actual.priceTry;
}
