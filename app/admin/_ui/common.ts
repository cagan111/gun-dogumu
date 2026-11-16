import type { StatusTone } from "../../panel/_ui/util";

export const STATUS_TONE: Record<string, StatusTone> = { trial: "sky", active: "green", past_due: "amber", suspended: "red" };
export const PLAN_IDS = ["baslangic", "pro", "salon_plus"] as const;

export function fmtDate(iso: string | null | undefined, locale: "tr" | "en", withTime = false): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}), timeZone: "Asia/Famagusta" }).format(new Date(iso));
}
export interface TenantRow {
  id: string; slug: string; name: string; city: string | null; plan: string; status: "trial" | "active" | "past_due" | "suspended";
  trialEndsAt: string | null; subscriptionEndsAt: string | null; smsBalance: number; lastLoginAt: string | null; createdAt: string;
}
