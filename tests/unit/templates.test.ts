import { describe, expect, it } from "vitest";
import { TEMPLATE_NAMES, appUrl, asLocale, cancelUrl, formatWhen, reminderTemplateFor, renderTemplate, templateSubject, withFooter, type TemplateVars } from "@/lib/messaging/templates";
import { smsSegments } from "@/lib/messaging/segments";

const token = "A".repeat(32);
const vars: TemplateVars = {
  salon: "Güzellik Salonu Elif", service: "Saç Kesimi + Fön", staff: "Ayşe", date: "17 Kas", time: "14:30",
  url: cancelUrl(token, { APP_DOMAIN: "randevu.example.cy" }), code: "123456", days: 3, balance: 0,
};

describe("appUrl / cancelUrl", () => {
  it("APP_DOMAIN https'e çevrilir, yoksa NEXTAUTH_URL, yoksa localhost", () => {
    expect(appUrl({ APP_DOMAIN: "x.cy", NEXTAUTH_URL: "http://localhost:3000" })).toBe("https://x.cy");
    expect(appUrl({ NEXTAUTH_URL: "https://a.cy/" })).toBe("https://a.cy");
    expect(appUrl({})).toBe("http://localhost:3000");
    expect(cancelUrl("tok", { APP_DOMAIN: "x.cy" })).toBe("https://x.cy/r/tok");
  });
});

describe("formatWhen", () => {
  it("salon saat diliminde tarih/saat (kış UTC+2) ve dil", () => {
    const at = new Date("2026-11-17T12:30:00Z"); // Famagusta kış: 14:30
    expect(formatWhen(at, "Asia/Famagusta", "tr")).toEqual({ date: "17 Kas", time: "14:30" });
    expect(formatWhen(at, "Asia/Famagusta", "en")).toEqual({ date: "17 Nov", time: "14:30" });
  });
  it("gece yarısını aşan UTC farkı yerel güne taşınır", () => {
    expect(formatWhen(new Date("2026-11-17T22:15:00Z"), "Asia/Famagusta", "tr")).toEqual({ date: "18 Kas", time: "00:15" });
  });
  it("yaz saatinde UTC+3", () => {
    expect(formatWhen(new Date("2026-07-01T10:00:00Z"), "Asia/Famagusta", "tr").time).toBe("13:00");
  });
});

describe("şablonlar", () => {
  it("hiçbir yer tutucu çözümsüz kalmaz (tr/en)", () => {
    for (const n of TEMPLATE_NAMES) for (const l of ["tr", "en"] as const) {
      const t = renderTemplate(n, l, vars);
      expect(t, `${n}/${l}`).not.toMatch(/\{\w+\}/);
      expect(t.length).toBeGreaterThan(10);
      expect(templateSubject(n, l).length).toBeGreaterThan(3);
    }
  });
  it("randevu mesajlarında salon, saat ve iptal bağlantısı var", () => {
    for (const n of ["confirmation", "reminder_24h", "reminder_2h", "changed_by_salon"] as const) {
      const t = renderTemplate(n, "tr", vars);
      expect(t).toContain("14:30");
      expect(t).toContain("Güzellik Salonu Elif");
      expect(t).toContain(`https://randevu.example.cy/r/${token}`);
    }
    expect(renderTemplate("otp", "tr", vars)).toContain("123456");
  });
  it("uzunluk: randevu şablonları ≤ 2 segment, hatırlatma ve OTP tek segment", () => {
    for (const l of ["tr", "en"] as const) {
      for (const n of TEMPLATE_NAMES) {
        const seg = smsSegments(renderTemplate(n, l, vars)).segments;
        expect(seg, `${n}/${l}`).toBeLessThanOrEqual(2);
      }
      for (const n of ["reminder_24h", "reminder_2h", "otp", "cancellation"] as const) {
        const t = renderTemplate(n, l, vars);
        expect(smsSegments(t).segments, `${n}/${l}: ${t.length}`).toBe(1);
      }
    }
  });
  it("otp markası ve süre", () => {
    expect(renderTemplate("otp", "tr", vars)).toMatch(/KıbrısRandevu.*123456.*5 dk/);
  });
  it("hatırlatma şablonu ofsete göre seçilir", () => {
    expect(reminderTemplateFor(1440)).toBe("reminder_24h");
    expect(reminderTemplateFor(720)).toBe("reminder_24h");
    expect(reminderTemplateFor(120)).toBe("reminder_2h");
    expect(reminderTemplateFor(30)).toBe("reminder_2h");
  });
  it("kampanya çıkış ifadesi", () => {
    expect(withFooter("İndirim var", "tr", "+905331112233")).toBe("İndirim var\nİptal için: +905331112233");
    expect(withFooter(" Sale ", "en", "+905331112233")).toBe("Sale\nTo opt out: +905331112233");
    expect(withFooter("x", "tr", null)).toContain("İptal için");
  });
  it("asLocale", () => {
    expect(asLocale("en")).toBe("en");
    expect(asLocale("de")).toBe("tr");
    expect(asLocale(null)).toBe("tr");
  });
});
