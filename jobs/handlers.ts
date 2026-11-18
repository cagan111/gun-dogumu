/** İş işleyicileri (pg-boss'tan bağımsız, doğrudan çağrılabilir/test edilebilir). */
import { prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { grantMonthlyCredits } from "../lib/messaging/credits";
import { ACTIVE_STATUSES, changedKey, cancelledKey, confirmationKey, reminderKey } from "../lib/messaging/schedule";
import { sendMessage, sendTenantEmail, type SendOutcome } from "../lib/messaging/send";
import { asLocale, cancelUrl, formatWhen, reminderTemplateFor, renderTemplate, templateSubject, type TemplateName } from "../lib/messaging/templates";
import type { ProviderDeps } from "../lib/messaging/types";
import { applySubscriptionTick } from "../lib/billing/subscription";

export interface Deps { providers?: Partial<ProviderDeps>; now?: Date }
export type HandlerResult = { status: "sent" | "failed" | "skipped" | "duplicate"; reason?: string; outcome?: SendOutcome };
const skip = (reason: string): HandlerResult => ({ status: "skipped", reason });

async function load(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: {
      tenant: { select: { name: true, timeZone: true, locale: true, status: true, reminderOffsets: true } },
      customer: { select: { phone: true, email: true, locale: true } },
      service: { select: { nameTr: true, nameEn: true } },
      staff: { select: { name: true } },
    },
  });
}
type Loaded = NonNullable<Awaited<ReturnType<typeof load>>>;

async function deliver(a: Loaded, template: TemplateName, key: string, deps: Deps): Promise<HandlerResult> {
  const locale = asLocale(a.customer.locale);
  const when = formatWhen(a.startsAt, a.tenant.timeZone, locale);
  const text = renderTemplate(template, locale, {
    salon: a.tenant.name, service: locale === "en" ? a.service.nameEn || a.service.nameTr : a.service.nameTr, staff: a.staff.name,
    ...when, url: cancelUrl(a.cancelToken, deps.providers?.env),
  });
  const reason = template === "reminder_24h" || template === "reminder_2h" ? "reminder" : template === "confirmation" ? "confirmation" : "notification";
  const outcome = await sendMessage({
    tenantId: a.tenantId, to: a.customer.phone, text, template, reason, appointmentId: a.id, idempotencyKey: key,
    fallback: { email: a.customer.email, subject: `${a.tenant.name}: ${templateSubject(template, locale)}` },
    deps: deps.providers, now: deps.now,
  });
  return { status: outcome.status, outcome };
}

export async function handleSendConfirmation(data: { appointmentId: string }, deps: Deps = {}): Promise<HandlerResult> {
  const a = await load(data.appointmentId);
  if (!a) return skip("not_found");
  if (!(ACTIVE_STATUSES as readonly string[]).includes(a.status)) return skip("not_active");
  if (a.tenant.status === "suspended") return skip("suspended");
  return deliver(a, "confirmation", confirmationKey(a.id), deps);
}

/** Hatırlatma: yeniden okur; iptal / taşınmış / ofset kaldırılmış / geçmiş / zaten gönderilmişse atlar. Sessiz saatler hatırlatmaya uygulanmaz. */
export async function handleSendReminder(data: { appointmentId: string; offsetMin: number; startsAt: string }, deps: Deps = {}): Promise<HandlerResult> {
  const now = deps.now ?? new Date();
  const a = await load(data.appointmentId);
  if (!a) return skip("not_found");
  if (!(ACTIVE_STATUSES as readonly string[]).includes(a.status)) return skip("not_active");
  if (a.startsAt.toISOString() !== data.startsAt) return skip("moved");
  if (!a.tenant.reminderOffsets.includes(data.offsetMin)) return skip("offset_removed");
  if (a.startsAt.getTime() <= now.getTime()) return skip("past");
  if (a.tenant.status === "suspended") return skip("suspended");
  const key = reminderKey(a.id, data.offsetMin, a.startsAt);
  return deliver(a, reminderTemplateFor(data.offsetMin), key, deps);
}

/** Salon kaynaklı değişiklik / iptal bildirimi. */
export async function handleSendNotice(data: { appointmentId: string; template: "changed_by_salon" | "cancellation"; startsAt: string }, deps: Deps = {}): Promise<HandlerResult> {
  const a = await load(data.appointmentId);
  if (!a) return skip("not_found");
  if (a.tenant.status === "suspended") return skip("suspended");
  if (data.template === "changed_by_salon") {
    if (!(ACTIVE_STATUSES as readonly string[]).includes(a.status)) return skip("not_active");
    if (a.startsAt.toISOString() !== data.startsAt) return skip("moved_again");
    return deliver(a, "changed_by_salon", changedKey(a.id, a.startsAt), deps);
  }
  if (a.status !== "cancelled_by_salon") return skip("not_cancelled");
  return deliver(a, "cancellation", cancelledKey(a.id), deps);
}

const DAY = 86_400_000;
/** Günlük: abonelik durumunu ilerlet ve uyarıları salon sahibine e-postayla gönder. */
export async function handleSubscriptionTick(deps: Deps = {}) {
  const now = deps.now ?? new Date();
  const tick = await applySubscriptionTick(now);
  let notified = 0;
  for (const n of tick.notices) {
    const t = await prisma.tenant.findUnique({ where: { id: n.tenantId }, select: { trialEndsAt: true } });
    const days = n.kind === "trial_ending" && t?.trialEndsAt ? Math.max(1, Math.ceil((t.trialEndsAt.getTime() - now.getTime()) / DAY)) : n.kind === "trial_ended" || n.kind === "past_due" ? 7 : 0;
    const template: TemplateName = n.kind;
    const r = await sendTenantEmail(n.tenantId, template, { days }, `sub:${n.tenantId}:${n.kind}:${n.anchor.toISOString()}`);
    if (r === "sent") notified++;
  }
  logger.info({ checked: tick.checked, transitions: tick.transitions.length, notices: tick.notices.length, notified }, "subscription-tick");
  return { ...tick, notified };
}

export async function handleMonthlyCredits(deps: Deps = {}) {
  const r = await grantMonthlyCredits(deps.now ?? new Date());
  logger.info(r, "monthly-credits");
  return r;
}

/** Periodic bounded recovery; never resends stored (potentially masked) content. */
export async function handleMessageRecovery() {
  const { reconcileQueuedMessages } = await import("../lib/messaging/recovery");
  return { recovered: await reconcileQueuedMessages() };
}
