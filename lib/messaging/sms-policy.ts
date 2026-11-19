import { lockSmsRecipient as lockRecipientBudget, smsRecipientUsage } from "../db";
/** Durable anonymous-SMS spend guard; reservations are never replenished by refunds. */
import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { LedgerTx } from "../ledger";
export const SMS_PHONE_DAILY_SEGMENTS = 6;
export class SmsPolicyBlocked extends Error {
  constructor(public reason: "sms_country_policy" | "sms_phone_daily_limit" | "sms_tenant_daily_limit") { super(reason); }
}
/** Global recipient lock MUST precede tenant lock. No other path acquires it after tenant. */
export async function lockSmsRecipient(tx: LedgerTx, phone: string) {
  await lockRecipientBudget(tx, phone);
}
/** Both global-phone and tenant locks are held. This trusted system query reveals no data to tenants. */
export async function checkSmsPolicy(tx: LedgerTx, tenantId: string, phone: string, segments: number, now: Date) {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { smsAllowedCallingCodes: true, smsDailySegmentLimit: true } });
  const code = parsePhoneNumberFromString(phone)?.countryCallingCode;
  if (!tenant || !code || !tenant.smsAllowedCallingCodes.includes(code)) throw new SmsPolicyBlocked("sms_country_policy");
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(+start + 86_400_000);
  // Deliberately global: one recipient cannot be pumped by rotating target salons.
  const totals = await smsRecipientUsage(tx, phone, start, end);
  if ((totals[0]?.used ?? 0) + segments > SMS_PHONE_DAILY_SEGMENTS) throw new SmsPolicyBlocked("sms_phone_daily_limit");
  const local = await tx.messageLog.aggregate({ where: { createdAt: { gte: start, lt: end } }, _sum: { smsSafetySegments: true } });
  if ((local._sum.smsSafetySegments ?? 0) + segments > tenant.smsDailySegmentLimit) throw new SmsPolicyBlocked("sms_tenant_daily_limit");
}
