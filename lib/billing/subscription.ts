/**
 * Abonelik durum makinesi.
 * trial → (deneme bitti, ücretli abonelik yok) past_due → (PAST_DUE_GRACE_DAYS geçti) suspended.
 * active → (abonelik bitti) past_due. past_due → (ödeme geldi) active. suspended yapışkandır:
 * yalnız ödeme kaydı ya da süper-admin "askıdan çıkar" ile açılır (elle askıya almayı tick bozmaz).
 */
import type { TenantStatus } from "@prisma/client";
import { PAST_DUE_GRACE_DAYS } from "@/config/plans";
import { writeAudit } from "../audit";
import { prisma } from "../db";

export const DAY_MS = 86_400_000;
export const TRIAL_WARN_DAYS = 3;

export interface SubscriptionState {
  status: TenantStatus;
  trialEndsAt: Date | null;
  subscriptionEndsAt: Date | null;
  pastDueSince: Date | null;
}
export interface Transition { status: TenantStatus; pastDueSince: Date | null; changed: boolean }

const paid = (t: SubscriptionState, now: Date) => t.subscriptionEndsAt !== null && t.subscriptionEndsAt.getTime() > now.getTime();

/** Saf: tek adımlık geçiş. pastDueSince, gecikmeye girildiği an (now) olur; ödeme gelince temizlenir. */
export function nextStatus(t: SubscriptionState, now: Date): Transition {
  const keep = (changed = false): Transition => ({ status: t.status, pastDueSince: t.pastDueSince, changed });
  switch (t.status) {
    case "trial":
      if (paid(t, now)) return { status: "active", pastDueSince: null, changed: true };
      if (t.trialEndsAt && t.trialEndsAt.getTime() <= now.getTime()) return { status: "past_due", pastDueSince: now, changed: true };
      return keep();
    case "active":
      if (t.subscriptionEndsAt && t.subscriptionEndsAt.getTime() <= now.getTime()) return { status: "past_due", pastDueSince: now, changed: true };
      return keep();
    case "past_due": {
      if (paid(t, now)) return { status: "active", pastDueSince: null, changed: true };
      if (!t.pastDueSince) return { status: "past_due", pastDueSince: now, changed: true }; // eksik işaret onarılır
      if (now.getTime() - t.pastDueSince.getTime() >= PAST_DUE_GRACE_DAYS * DAY_MS) return { status: "suspended", pastDueSince: t.pastDueSince, changed: true };
      return keep();
    }
    case "suspended":
      return keep();
  }
}

export type NoticeKind = "trial_ending" | "trial_ended" | "past_due" | "suspended";
export interface Notice { tenantId: string; kind: NoticeKind; anchor: Date }

/** Saf: bu durumda hangi uyarılar gerekir (yinelenme DB'de anchor ile elenir). */
export function noticesFor(tenantId: string, before: SubscriptionState, after: Transition, now: Date): Notice[] {
  const out: Notice[] = [];
  if (before.status === "trial" && !paid(before, now) && before.trialEndsAt) {
    const left = before.trialEndsAt.getTime() - now.getTime();
    if (left > 0 && left <= TRIAL_WARN_DAYS * DAY_MS) out.push({ tenantId, kind: "trial_ending", anchor: before.trialEndsAt });
  }
  if (before.status === "trial" && after.status === "past_due" && before.trialEndsAt) out.push({ tenantId, kind: "trial_ended", anchor: before.trialEndsAt });
  if (before.status === "active" && after.status === "past_due" && before.subscriptionEndsAt) out.push({ tenantId, kind: "past_due", anchor: before.subscriptionEndsAt });
  if (before.status === "past_due" && after.status === "suspended") out.push({ tenantId, kind: "suspended", anchor: after.pastDueSince ?? now });
  return out;
}

export interface TickResult {
  checked: number;
  transitions: { tenantId: string; from: TenantStatus; to: TenantStatus }[];
  /** Gönderilecek yeni uyarılar (gönderim T-050/T-054; burada yalnız döner ve AuditLog'a işlenir). */
  notices: Notice[];
}

/** Tüm tenant'ları günceller, AuditLog yazar, tekrarsız uyarı listesini döner. Sistem işi: tenant'lar arası. */
export async function applySubscriptionTick(now: Date = new Date(), opts: { client?: typeof prisma; tenantIds?: string[] } = {}): Promise<TickResult> {
  const client = opts.client ?? prisma;
  const tenants = await client.tenant.findMany({
    where: { status: { in: ["trial", "active", "past_due"] }, ...(opts.tenantIds ? { id: { in: opts.tenantIds } } : {}) },
    select: { id: true, status: true, trialEndsAt: true, subscriptionEndsAt: true, pastDueSince: true },
  });
  const result: TickResult = { checked: tenants.length, transitions: [], notices: [] };
  for (const t of tenants) {
    const next = nextStatus(t, now);
    if (next.changed) {
      const r = await client.tenant.updateMany({ where: { id: t.id, status: t.status }, data: { status: next.status, pastDueSince: next.pastDueSince } });
      if (r.count === 1) {
        await writeAudit(client, { actorRole: "system", tenantId: t.id, action: "subscription.status_changed", details: { from: t.status, to: next.status, at: now.toISOString() } });
        result.transitions.push({ tenantId: t.id, from: t.status, to: next.status });
      }
    }
    for (const n of noticesFor(t.id, t, next, now)) {
      const dup = await client.auditLog.findFirst({
        where: { tenantId: n.tenantId, action: `subscription.notice.${n.kind}`, details: { path: ["anchor"], equals: n.anchor.toISOString() } },
        select: { id: true },
      });
      if (dup) continue;
      await writeAudit(client, { actorRole: "system", tenantId: n.tenantId, action: `subscription.notice.${n.kind}`, details: { anchor: n.anchor.toISOString() } });
      result.notices.push(n);
    }
  }
  return result;
}
