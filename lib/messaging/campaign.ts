/** Kampanya SMS'i: Salon+; yalnız pazarlama izni olan müşteriler; çıkış ifadesi eklenir; sessiz saatlerde reddedilir. */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { BookingError } from "../booking";
import { prisma, withTenant } from "../db";
import { InsufficientCreditsError, SuspendedError, ValidationError } from "../errors";
import { getBalance } from "../ledger";
import { assertFeature } from "../plan";
import { getSmsProvider } from "./registry";
import { isQuietHour } from "./schedule";
import { smsSegments } from "./segments";
import { asLocale, withFooter } from "./templates";
import { sendMessage } from "./send";
import type { ProviderDeps } from "./types";

export class QuietHoursError extends BookingError {
  constructor() { super("quiet_hours", "Sessiz saatlerde kampanya gönderilemez"); }
}

export const campaignSchema = z.object({ text: z.string().trim().min(3).max(500) });

export async function sendCampaign(tenantId: string, text: string, now: Date = new Date(), deps?: Partial<ProviderDeps>) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) throw new ValidationError("Salon bulunamadı", "tenantId");
  if (t.status === "suspended") throw new SuspendedError();
  assertFeature(t.plan, "campaigns");
  if (isQuietHour(now, t.timeZone, t.quietStartHour, t.quietEndHour)) throw new QuietHoursError();
  const body = text.trim();
  if (body.length < 3 || body.length > 500) throw new ValidationError("Metin 3–500 karakter olmalı", "text");

  const db = withTenant(tenantId);
  const full = withFooter(body, asLocale(t.locale), t.phone);
  const customers = await db.customer.findMany({ where: { marketingConsent: true }, select: { id: true, phone: true }, orderBy: { id: "asc" } });
  const per = smsSegments(full, getSmsProvider(t.smsProvider, deps).segmentProfile).segments;
  const total = per * customers.length;
  const balance = await getBalance(db);
  if (total > balance) throw new InsufficientCreditsError(balance, total);

  const campaignId = randomBytes(6).toString("hex");
  const r = { campaignId, recipients: customers.length, segmentsPerMessage: per, sent: 0, failed: 0, skipped: 0 };
  for (const c of customers) {
    const o = await sendMessage({ tenantId, to: c.phone, text: full, template: "campaign", reason: "campaign", idempotencyKey: `camp:${campaignId}:${c.id}`, fallback: { whatsapp: false }, deps, now });
    if (o.status === "sent") r.sent++; else if (o.status === "failed") r.failed++; else r.skipped++;
  }
  return r;
}
