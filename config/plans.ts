/** Varsayılan plan tanımları (TL/ay). Admin panel değerleri DB'de ezebilir (PlanPrice). */
export type PlanId = "baslangic" | "pro" | "salon_plus";

export interface PlanDef {
  id: PlanId;
  name: { tr: string; en: string };
  priceTry: number;
  maxStaff: number | null; // null = sınırsız
  monthlySms: number;
  features: { reports: boolean; customerNotes: boolean; multiBranch: boolean; whatsapp: boolean; campaigns: boolean };
}

export const TRIAL_DAYS = 14;
export const PAST_DUE_GRACE_DAYS = 7;

export const PLANS: Record<PlanId, PlanDef> = {
  baslangic: { id: "baslangic", name: { tr: "Başlangıç", en: "Starter" }, priceTry: 750, maxStaff: 1, monthlySms: 100,
    features: { reports: false, customerNotes: false, multiBranch: false, whatsapp: false, campaigns: false } },
  pro: { id: "pro", name: { tr: "Pro", en: "Pro" }, priceTry: 1250, maxStaff: 5, monthlySms: 300,
    features: { reports: true, customerNotes: true, multiBranch: false, whatsapp: false, campaigns: false } },
  salon_plus: { id: "salon_plus", name: { tr: "Salon+", en: "Salon+" }, priceTry: 2000, maxStaff: null, monthlySms: 300,
    features: { reports: true, customerNotes: true, multiBranch: true, whatsapp: true, campaigns: true } },
};

export const SMS_PACKAGES = [500, 1000, 5000] as const;
