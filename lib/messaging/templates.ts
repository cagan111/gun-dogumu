/** Mesaj şablonları (tr/en). Kısa tutulur: çoğu tek segment. Tarih/saat salon saat diliminde, salon diliyle. */
import { brand } from "@/config/brand";
import { utcToLocal } from "../time";

export type Locale = "tr" | "en";
export const TEMPLATE_NAMES = [
  "confirmation", "reminder_24h", "reminder_2h", "cancellation", "changed_by_salon", "otp",
  "trial_ending", "trial_ended", "past_due", "suspended", "low_credit",
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export interface TemplateVars {
  salon?: string; service?: string; staff?: string; date?: string; time?: string; url?: string;
  code?: string; days?: number; balance?: number; phone?: string;
}

type Tpl = { tr: string; en: string };
const T: Record<TemplateName, Tpl> = {
  confirmation: {
    tr: "{salon}: {date} {time} {service} randevunuz onaylandı. İptal/değişiklik: {url}",
    en: "{salon}: your {service} booking on {date} {time} is confirmed. Cancel/change: {url}",
  },
  reminder_24h: {
    tr: "Hatırlatma: {date} {time} {salon} ({service}). İptal: {url}",
    en: "Reminder: {date} {time} at {salon} ({service}). Cancel: {url}",
  },
  reminder_2h: {
    tr: "Randevu saatiniz {time}, {salon} ({service}). İptal: {url}",
    en: "Your appointment is at {time}, {salon} ({service}). Cancel: {url}",
  },
  cancellation: {
    tr: "{salon}: {date} {time} randevunuz salon tarafından iptal edildi. Özür dileriz.",
    en: "{salon}: your {date} {time} appointment was cancelled by the salon. Sorry!",
  },
  changed_by_salon: {
    tr: "{salon}: randevunuz değişti. Yeni zaman: {date} {time} ({service}). İptal: {url}",
    en: "{salon}: your appointment changed. New time: {date} {time} ({service}). Cancel: {url}",
  },
  otp: {
    tr: "{brand} kodunuz: {code} (5 dk geçerli). Kimseyle paylaşmayın.",
    en: "{brand} code: {code} (valid 5 min). Do not share it.",
  },
  trial_ending: {
    tr: "{salon}: deneme süreniz {days} gün içinde bitiyor. Devam etmek için ödeme yapın.",
    en: "{salon}: your trial ends in {days} days. Pay to continue.",
  },
  trial_ended: {
    tr: "{salon}: deneme süreniz bitti. Hesabınız {days} gün içinde askıya alınır; lütfen ödeme yapın.",
    en: "{salon}: your trial ended. Your account is suspended in {days} days unless you pay.",
  },
  past_due: {
    tr: "{salon}: aboneliğiniz sona erdi. {days} gün içinde ödeme yapılmazsa hesabınız askıya alınır.",
    en: "{salon}: your subscription ended. Pay within {days} days or your account is suspended.",
  },
  suspended: {
    tr: "{salon}: hesabınız askıya alındı, online randevu kapalı. Ödeme için bize ulaşın.",
    en: "{salon}: your account is suspended and online booking is off. Contact us to pay.",
  },
  low_credit: {
    tr: "{salon}: SMS krediniz bitti (kalan {balance}). Randevu SMS'leri gönderilemiyor; paket talep edin.",
    en: "{salon}: your SMS credit ran out ({balance} left). Appointment SMS can't be sent; request a package.",
  },
};

const SUBJECT: Record<TemplateName, Tpl> = {
  confirmation: { tr: "Randevunuz onaylandı", en: "Your booking is confirmed" },
  reminder_24h: { tr: "Randevu hatırlatması", en: "Appointment reminder" },
  reminder_2h: { tr: "Randevu hatırlatması", en: "Appointment reminder" },
  cancellation: { tr: "Randevunuz iptal edildi", en: "Your appointment was cancelled" },
  changed_by_salon: { tr: "Randevunuz değişti", en: "Your appointment changed" },
  otp: { tr: "Doğrulama kodu", en: "Verification code" },
  trial_ending: { tr: "Deneme süreniz bitiyor", en: "Your trial is ending" },
  trial_ended: { tr: "Deneme süreniz bitti", en: "Your trial has ended" },
  past_due: { tr: "Aboneliğiniz sona erdi", en: "Your subscription ended" },
  suspended: { tr: "Hesabınız askıya alındı", en: "Your account is suspended" },
  low_credit: { tr: "SMS krediniz bitti", en: "You are out of SMS credit" },
};

export const FOOTER = {
  tr: "İptal için: {phone}",
  en: "To opt out: {phone}",
} as const;
const FOOTER_NOPHONE = { tr: "İptal için salona bildirin.", en: "To opt out tell the salon." } as const;

export const asLocale = (l: string | null | undefined): Locale => (l === "en" ? "en" : "tr");

/** APP_DOMAIN → https://domain, yoksa NEXTAUTH_URL, yoksa localhost. */
export function appUrl(env: Record<string, string | undefined> = process.env): string {
  const base = env.APP_DOMAIN ? `https://${env.APP_DOMAIN}` : env.NEXTAUTH_URL || "http://localhost:3000";
  return base.replace(/\/$/, "");
}
export const cancelUrl = (token: string, env?: Record<string, string | undefined>) => `${appUrl(env)}/r/${token}`;

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Salon saat diliminde kısa tarih ("17 Kas" / "17 Nov") ve saat ("14:30"). Bugün/yarın etiketi yok: SMS gecikse de doğru kalsın. */
export function formatWhen(at: Date, timeZone: string, locale: Locale): { date: string; time: string } {
  const l = utcToLocal(at, timeZone);
  const [, m, d] = l.date.split("-").map(Number) as [number, number, number];
  const hh = String(Math.floor(l.minutes / 60)).padStart(2, "0");
  const mm = String(l.minutes % 60).padStart(2, "0");
  return { date: `${d} ${(locale === "tr" ? MONTHS_TR : MONTHS_EN)[m - 1]}`, time: `${hh}:${mm}` };
}

function fill(tpl: string, v: Record<string, string | number | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(v[k] ?? ""));
}

export function renderTemplate(name: TemplateName, locale: Locale, vars: TemplateVars): string {
  return fill(T[name][locale], { brand: brand.name, ...vars });
}
export function templateSubject(name: TemplateName, locale: Locale): string {
  return SUBJECT[name][locale];
}

/** Kampanya metnine çıkış ifadesi ekler. */
export function withFooter(text: string, locale: Locale, phone?: string | null): string {
  const f = phone ? fill(FOOTER[locale], { phone }) : FOOTER_NOPHONE[locale];
  return `${text.trim()}\n${f}`;
}

/** Hatırlatma ofsetine göre şablon: ≥12 saat → reminder_24h (tarih+saat), daha yakın → reminder_2h (yalnız saat). */
export function reminderTemplateFor(offsetMin: number): "reminder_24h" | "reminder_2h" {
  return offsetMin >= 720 ? "reminder_24h" : "reminder_2h";
}
