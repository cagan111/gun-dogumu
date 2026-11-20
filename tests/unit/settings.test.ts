import { describe, expect, it } from "vitest";
import { validateWorkingDays, workingHoursSchema } from "@/lib/hours";
import { monthRangeUtc } from "@/lib/panel/reports";
import { settingsSchema } from "@/lib/panel/settings";
import { smsRequestSchema } from "@/lib/panel/settings";

const ok = (o: unknown) => settingsSchema.safeParse(o).success;

describe("settingsSchema", () => {
  it("review invites accept only explicit booleans and approved Google review links", () => {
    expect(ok({ reviewInviteEnabled: false, reviewInviteUrl: null })).toBe(true);
    for (const url of ["https://search.google.com/local/writereview?placeid=ChIJ_fixture-1", "https://g.page/r/C_fixture-1/review"]) expect(ok({ reviewInviteUrl: url })).toBe(true);
    for (const url of ["https://google.com/url?q=https://evil.example", "https://search.google.com.evil.example/local/writereview?placeid=x", "https://g.page/redirect", "http://g.page/r/example/review", "https://user:pass@g.page/r/example/review", "https://g.page/r/example/review#x", "https://search.google.com/local/writereview?placeid=a&placeid=b"]) expect(ok({ reviewInviteUrl: url })).toBe(false);
    expect(ok({ reviewInviteEnabled: "true" })).toBe(false);
  });
  it.each(["   ", "123456", ".- .", "Salon\n", "Salon\r", "Salon\t"])("anlamsız/kontrol karakterli SMS başlığını reddeder: %j", (sender) => {
    expect(ok({ smsSenderName: sender })).toBe(false);
  });
  it("SMS başlığı: ≤11 karakter, A-Z a-z 0-9 boşluk . -", () => {
    expect(ok({ smsSenderName: "Glow Kuafor" })).toBe(true);
    expect(ok({ smsSenderName: "A.B-c 1" })).toBe(true);
    expect(ok({ smsSenderName: null })).toBe(true);
    expect(ok({ smsSenderName: "Çok Uzun Salon Adı" })).toBe(false);
    expect(ok({ smsSenderName: "Kuaför" })).toBe(false); // Türkçe harf yok
    expect(ok({ smsSenderName: "a_b" })).toBe(false);
    expect(ok({ smsSenderName: "" })).toBe(false);
  });
  it("hatırlatma: 1–3 öğe, her biri 30–10080, tekrarsız", () => {
    expect(ok({ reminderOffsets: [1440, 120] })).toBe(true);
    expect(ok({ reminderOffsets: [30] })).toBe(true);
    expect(ok({ reminderOffsets: [10080, 1440, 30] })).toBe(true);
    expect(ok({ reminderOffsets: [] })).toBe(false);
    expect(ok({ reminderOffsets: [29] })).toBe(false);
    expect(ok({ reminderOffsets: [10081] })).toBe(false);
    expect(ok({ reminderOffsets: [60, 120, 180, 240] })).toBe(false);
    expect(ok({ reminderOffsets: [60, 60] })).toBe(false);
  });
  it("slotMinutes yalnız 5/10/15/20/30/60", () => {
    for (const n of [5, 10, 15, 20, 30, 60]) expect(ok({ slotMinutes: n })).toBe(true);
    for (const n of [0, 7, 25, 45, 90]) expect(ok({ slotMinutes: n })).toBe(false);
  });
  it("renk, URL, dil, saat dilimi", () => {
    expect(ok({ brandColor: "#aa00FF" })).toBe(true);
    expect(ok({ brandColor: "aa00ff" })).toBe(false);
    expect(ok({ brandColor: "#abc" })).toBe(false);
    expect(ok({ logoUrl: "https://cdn.example.com/a.png", coverUrl: null })).toBe(true);
    expect(ok({ logoUrl: "http://example.com/a.png" })).toBe(false);
    expect(ok({ logoUrl: "javascript:alert(1)" })).toBe(false);
    expect(ok({ locale: "en" })).toBe(true);
    expect(ok({ locale: "de" })).toBe(false);
    expect(ok({ timeZone: "Asia/Famagusta" })).toBe(true);
    expect(ok({ timeZone: "Mars/Olympus" })).toBe(false);
  });
  it("sayısal kurallar ve bilinmeyen/boş girdi", () => {
    expect(ok({ cancelHoursBefore: 0, minLeadMinutes: 0, maxAdvanceDays: 1 })).toBe(true);
    expect(ok({ maxAdvanceDays: 0 })).toBe(false);
    expect(ok({ maxAdvanceDays: 366 })).toBe(false);
    expect(ok({ cancelHoursBefore: -1 })).toBe(false);
    expect(ok({})).toBe(false);
    expect(ok({ plan: "pro" })).toBe(false); // plan buradan değişmez (strict)
  });
  it("SMS paket talebi yalnız tanımlı boyutlar", () => {
    expect(smsRequestSchema.safeParse({ size: 500 }).success).toBe(true);
    expect(smsRequestSchema.safeParse({ size: 5000 }).success).toBe(true);
    expect(smsRequestSchema.safeParse({ size: 700 }).success).toBe(false);
  });
});

const day = (o: Partial<{ weekday: number; startMin: number; endMin: number; breaks: [number, number][] }> = {}) => ({ weekday: 1, startMin: 540, endMin: 1080, breaks: [] as [number, number][], ...o });

describe("çalışma saati doğrulama", () => {
  it("geçerli gün ve sıralı molalar", () => {
    const r = validateWorkingDays([day({ breaks: [[900, 930], [720, 780]] })]);
    expect(r[0]?.breaks).toEqual([[720, 780], [900, 930]]);
  });
  it("mola saat dışında / çakışan / ters / aynı gün iki kez / bitiş<=başlangıç reddedilir", () => {
    expect(() => validateWorkingDays([day({ breaks: [[500, 560]] })])).toThrow();
    expect(() => validateWorkingDays([day({ breaks: [[1000, 1100]] })])).toThrow();
    expect(() => validateWorkingDays([day({ breaks: [[700, 800], [750, 820]] })])).toThrow();
    expect(() => validateWorkingDays([day({ breaks: [[800, 800]] })])).toThrow();
    expect(() => validateWorkingDays([day(), day()])).toThrow();
    expect(() => validateWorkingDays([day({ startMin: 600, endMin: 600 })])).toThrow();
  });
  it("bitişe değen mola serbest; gece yarısı aşan vardiya serbest", () => {
    expect(() => validateWorkingDays([day({ breaks: [[540, 600], [1020, 1080]] })])).not.toThrow();
    expect(() => validateWorkingDays([day({ startMin: 1200, endMin: 1560, breaks: [[1440, 1470]] })])).not.toThrow();
  });
  it("şema: weekday 0–6, en çok 7 gün", () => {
    expect(workingHoursSchema.safeParse({ days: [day({ weekday: 7 })] }).success).toBe(false);
    expect(workingHoursSchema.safeParse({ days: [day()] }).success).toBe(true);
  });
});

describe("rapor ay aralığı", () => {
  it("salon saat diliminde ay sınırları (kış UTC+2)", () => {
    const r = monthRangeUtc("2026-12", "Asia/Famagusta");
    expect(r.start.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-12-31T22:00:00.000Z");
  });
  it("aralık ay boyunca yıl devrini doğru yapar", () => {
    const r = monthRangeUtc("2026-12", "UTC");
    expect(r.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
