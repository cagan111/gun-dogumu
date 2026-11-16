import { describe, expect, it } from "vitest";
import { addDays, dayRangeUtc, isValidTimeZone, utcToLocal, weekdayOf, zonedToUtc } from "@/lib/time";

const iso = (d: Date) => d.toISOString();

describe("zonedToUtc / utcToLocal", () => {
  it("Asia/Famagusta (tzdata'da EU kuralı) ve Europe/Istanbul (sabit UTC+3)", () => {
    expect(iso(zonedToUtc("2026-07-15", 10 * 60, "Asia/Famagusta"))).toBe("2026-07-15T07:00:00.000Z");
    expect(iso(zonedToUtc("2026-01-15", 10 * 60, "Asia/Famagusta"))).toBe("2026-01-15T08:00:00.000Z");
    expect(iso(zonedToUtc("2026-01-15", 10 * 60, "Europe/Istanbul"))).toBe("2026-01-15T07:00:00.000Z");
    expect(iso(zonedToUtc("2026-07-15", 10 * 60, "Europe/Istanbul"))).toBe("2026-07-15T07:00:00.000Z");
  });
  it("Europe/Nicosia yazın UTC+3, kışın UTC+2", () => {
    expect(iso(zonedToUtc("2026-07-15", 600, "Europe/Nicosia"))).toBe("2026-07-15T07:00:00.000Z");
    expect(iso(zonedToUtc("2026-01-15", 600, "Europe/Nicosia"))).toBe("2026-01-15T08:00:00.000Z");
  });
  it("ilkbahar geçişi: olmayan saat ileri kaydırılır (2026-03-29 03:30 yok)", () => {
    expect(iso(zonedToUtc("2026-03-29", 2 * 60 + 59, "Europe/Nicosia"))).toBe("2026-03-29T00:59:00.000Z"); // 02:59 EET
    expect(iso(zonedToUtc("2026-03-29", 4 * 60, "Europe/Nicosia"))).toBe("2026-03-29T01:00:00.000Z"); // 04:00 EEST
    expect(iso(zonedToUtc("2026-03-29", 3 * 60 + 30, "Europe/Nicosia"))).toBe("2026-03-29T01:30:00.000Z"); // 04:30 EEST
  });
  it("sonbahar geçişi: tekrarlanan saat ilk (yaz) anına çözülür (2026-10-25)", () => {
    expect(iso(zonedToUtc("2026-10-25", 3 * 60 + 30, "Europe/Nicosia"))).toBe("2026-10-25T00:30:00.000Z");
    expect(iso(zonedToUtc("2026-10-25", 5 * 60, "Europe/Nicosia"))).toBe("2026-10-25T03:00:00.000Z");
  });
  it("gün taşan dakika ve 1440 ertesi gün 00:00", () => {
    expect(iso(zonedToUtc("2026-07-15", 1440, "Asia/Famagusta"))).toBe("2026-07-15T21:00:00.000Z");
    expect(iso(zonedToUtc("2026-07-15", 1500, "Asia/Famagusta"))).toBe("2026-07-15T22:00:00.000Z");
    expect(iso(zonedToUtc("2026-07-15", -60, "Asia/Famagusta"))).toBe("2026-07-14T20:00:00.000Z");
  });
  it("utcToLocal doğru tarih/dakika/gün verir, gece yarısı sınırı dahil", () => {
    expect(utcToLocal(new Date("2026-07-15T21:00:00Z"), "Asia/Famagusta")).toEqual({ date: "2026-07-16", minutes: 0, weekday: 4 });
    expect(utcToLocal(new Date("2026-07-15T20:59:00Z"), "Asia/Famagusta")).toEqual({ date: "2026-07-15", minutes: 1439, weekday: 3 });
    expect(utcToLocal(new Date("2026-01-01T00:00:00Z"), "Europe/Nicosia")).toEqual({ date: "2026-01-01", minutes: 120, weekday: 4 });
  });
  it("gidiş-dönüş tutarlı (DST günü dahil)", () => {
    for (const tz of ["Europe/Nicosia", "Asia/Famagusta", "Europe/Istanbul"]) {
      const dstZone = tz !== "Europe/Istanbul";
      for (const date of ["2026-03-28", "2026-03-29", "2026-03-30", "2026-10-24", "2026-10-25", "2026-10-26"]) {
        for (let m = 0; m < 1440; m += 15) {
          const back = utcToLocal(zonedToUtc(date, m, tz), tz);
          if (back.date === date && back.minutes === m) continue;
          // yalnız DST boşluğundaki olmayan saatler farklı çıkabilir
          expect(dstZone).toBe(true);
          expect(date).toBe("2026-03-29");
          expect(m).toBeGreaterThanOrEqual(180);
          expect(m).toBeLessThan(240);
        }
      }
    }
  });
  it("DST gününün uzunluğu 23 / 25 saat", () => {
    const h = (d: string) => { const r = dayRangeUtc(d, "Europe/Nicosia"); return (r.end.getTime() - r.start.getTime()) / 3_600_000; };
    expect(h("2026-03-29")).toBe(23);
    expect(h("2026-10-25")).toBe(25);
    expect(h("2026-06-01")).toBe(24);
    const f = dayRangeUtc("2026-03-29", "Asia/Famagusta");
    expect((f.end.getTime() - f.start.getTime()) / 3_600_000).toBe(23);
    const i = dayRangeUtc("2026-03-29", "Europe/Istanbul");
    expect((i.end.getTime() - i.start.getTime()) / 3_600_000).toBe(24);
  });
});

describe("takvim yardımcıları", () => {
  it("addDays ay/yıl/artık yıl", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weekdayOf: 0 = Pazar", () => {
    expect(weekdayOf("2026-11-15")).toBe(0);
    expect(weekdayOf("2026-11-16")).toBe(1);
  });
  it("geçersiz tarih ve bölgeyi reddeder", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow();
    expect(() => addDays("26-1-1", 1)).toThrow();
    expect(isValidTimeZone("Asia/Famagusta")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
