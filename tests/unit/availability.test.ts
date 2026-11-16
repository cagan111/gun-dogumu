import { describe, expect, it } from "vitest";
import { computeAvailability, type AvailabilityInput, type StaffAvailabilityInput, type WorkingHoursInput } from "@/lib/availability";
import { utcToLocal, zonedToUtc } from "@/lib/time";

const TZ = "Asia/Famagusta";
const NOW = new Date("2026-06-01T00:00:00Z"); // yerel 03:00, Pazartesi
const H = (h: number, m = 0) => h * 60 + m;

function wh(weekday: number, startMin: number, endMin: number, breaks: [number, number][] = []): WorkingHoursInput {
  return { weekday, startMin, endMin, breaks };
}
/** Her gün aynı çalışma saati */
function allDays(startMin: number, endMin: number, breaks: [number, number][] = []): WorkingHoursInput[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => wh(d, startMin, endMin, breaks));
}
function staff(id: string, workingHours: WorkingHoursInput[], timeOff: StaffAvailabilityInput["timeOff"] = []): StaffAvailabilityInput {
  return { id, workingHours, timeOff };
}
function run(over: Partial<AvailabilityInput> & { date: string }) {
  return computeAvailability({
    tenant: { timeZone: TZ, slotMinutes: 15, minLeadMinutes: 0, maxAdvanceDays: 60 },
    service: { durationMin: 30, bufferMin: 0 },
    staff: [staff("a", allDays(H(9), H(12)))],
    busy: [],
    now: NOW,
    ...over,
  });
}
/** Slotları yerel "HH:MM" olarak göster */
function times(slots: ReturnType<typeof run>, tz = TZ) {
  return slots.map((s) => {
    const l = utcToLocal(s.start, tz);
    return `${String(Math.floor(l.minutes / 60)).padStart(2, "0")}:${String(l.minutes % 60).padStart(2, "0")}`;
  });
}
const at = (date: string, min: number, tz = TZ) => zonedToUtc(date, min, tz);
const D = "2026-06-03"; // Çarşamba

describe("temel slot üretimi", () => {
  it("çalışma saati içinde slotMinutes adımıyla, bitişe sığanları üretir", () => {
    expect(times(run({ date: D }))).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30"]);
  });
  it("slotlar çalışma saati başlangıcına hizalanır", () => {
    const r = run({ date: D, staff: [staff("a", allDays(H(9, 10), H(10, 40)))] });
    expect(times(r)).toEqual(["09:10", "09:25", "09:40", "09:55", "10:10"]);
  });
  it("kapalı gün / çalışma saati yok → boş", () => {
    expect(run({ date: D, staff: [staff("a", [wh(1, H(9), H(12))])] })).toEqual([]); // yalnız Pazartesi çalışıyor, D Çarşamba
    expect(run({ date: D, staff: [staff("a", [])] })).toEqual([]);
    expect(run({ date: D, staff: [] })).toEqual([]);
  });
  it("hizmet süresi vardiyadan uzunsa slot yok", () => {
    expect(run({ date: D, service: { durationMin: 200, bufferMin: 0 } })).toEqual([]);
  });
});

describe("mola, izin, tampon, ardışık randevu", () => {
  it("mola ile çakışan slotlar çıkar, molanın hemen öncesine sığan kalır", () => {
    const r = run({ date: D, staff: [staff("a", allDays(H(9), H(13), [[H(10), H(11)]]))] });
    expect(times(r)).toEqual(["09:00", "09:15", "09:30", "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30"]);
  });
  it("izin aralığı içindeki slotları çıkarır", () => {
    const r = run({ date: D, staff: [staff("a", allDays(H(9), H(12)), [{ startsAt: at(D, H(10)), endsAt: at(D, H(11)) }])] });
    expect(times(r)).toEqual(["09:00", "09:15", "09:30", "11:00", "11:15", "11:30"]);
  });
  it("birden çok güne yayılan izin tüm günleri kapatır", () => {
    const off = [{ startsAt: at("2026-06-02", H(18)), endsAt: at("2026-06-05", H(8)) }];
    const s = [staff("a", allDays(H(9), H(12)), off)];
    expect(run({ date: "2026-06-02", staff: s }).length).toBeGreaterThan(0); // 18:00'a kadar iş saati zaten bitmiş; 09–12 açık
    expect(run({ date: "2026-06-03", staff: s })).toEqual([]);
    expect(run({ date: "2026-06-04", staff: s })).toEqual([]);
    expect(times(run({ date: "2026-06-05", staff: s }))).toContain("09:00");
  });
  it("tampon süresi vardiya sonuna sığmayı etkiler", () => {
    const r = run({ date: D, service: { durationMin: 30, bufferMin: 15 } });
    expect(times(r).at(-1)).toBe("11:15"); // 11:15 + 45 dk = 12:00
    expect(times(r)).not.toContain("11:30");
  });
  it("mevcut randevu ve tamponu bloke eder; art arda randevu serbest", () => {
    // 10:00–10:30 hizmet + 15 dk tampon = 10:45'e kadar dolu
    const busy = [{ staffId: "a", startsAt: at(D, H(10)), blockedUntil: at(D, H(10, 45)) }];
    const r = run({ date: D, busy });
    const t = times(r);
    expect(t).toContain("09:30"); // 09:30–10:00 tam bitişik
    expect(t).not.toContain("09:45");
    expect(t).not.toContain("10:30");
    expect(t).toContain("10:45"); // tam bloğun bitiminde
  });
  it("yeni randevunun tamponu bir sonraki randevuya taşmamalı", () => {
    const busy = [{ staffId: "a", startsAt: at(D, H(10)), blockedUntil: at(D, H(10, 30)) }];
    const r = run({ date: D, busy, service: { durationMin: 30, bufferMin: 15 } });
    expect(times(r)).toContain("09:15"); // 09:15–10:00 (30+15) sığar
    expect(times(r)).not.toContain("09:30"); // 09:30+45 = 10:15 çakışır
  });
  it("başka personelin randevusu etkilemez", () => {
    const busy = [{ staffId: "b", startsAt: at(D, H(9)), blockedUntil: at(D, H(12)) }];
    expect(times(run({ date: D, busy })).length).toBe(11);
  });
});

describe("en erken / en geç kuralı", () => {
  it("minLead: now + lead'den önceki slotlar elenir", () => {
    const now = at(D, H(9)); // 09:00 yerel
    const r = run({ date: D, now, tenant: { timeZone: TZ, slotMinutes: 15, minLeadMinutes: 60, maxAdvanceDays: 60 } });
    expect(times(r)[0]).toBe("10:00"); // >= 10:00 dahil
  });
  it("geçmiş gün boş", () => {
    expect(run({ date: "2026-05-31" })).toEqual([]);
  });
  it("maxAdvanceDays: sınır gün dahil, sonrası boş", () => {
    const tenant = { timeZone: TZ, slotMinutes: 15, minLeadMinutes: 0, maxAdvanceDays: 7 };
    expect(run({ date: "2026-06-08", tenant }).length).toBeGreaterThan(0); // bugün 06-01 + 7
    expect(run({ date: "2026-06-09", tenant })).toEqual([]);
  });
  it("'bugün' yerel tarihe göre hesaplanır (UTC gece yarısı değil)", () => {
    const now = new Date("2026-06-01T22:30:00Z"); // yerel 06-02 01:30
    expect(run({ date: "2026-06-01", now })).toEqual([]);
    expect(run({ date: "2026-06-02", now }).length).toBeGreaterThan(0);
  });
});

describe("gece yarısı", () => {
  it("endMin = 1440: 24:00'e kadar sürer", () => {
    const r = run({ date: D, staff: [staff("a", allDays(H(22), 1440))] });
    expect(times(r)).toEqual(["22:00", "22:15", "22:30", "22:45", "23:00", "23:15", "23:30"]);
  });
  it("gece yarısını aşan vardiya: ertesi gün slotları ertesi tarihte görünür", () => {
    // Çarşamba (3) 22:00–26:00 (02:00 Perşembe)
    const s = [staff("a", [wh(3, H(22), H(26))])];
    expect(times(run({ date: D, staff: s }))).toEqual(["22:00", "22:15", "22:30", "22:45", "23:00", "23:15", "23:30", "23:45"]);
    // Perşembe'nin kendi vardiyası yok ama taşan kısım var
    expect(times(run({ date: "2026-06-04", staff: s }))).toEqual(["00:00", "00:15", "00:30", "00:45", "01:00", "01:15", "01:30"]);
  });
  it("taşan vardiyada slot gece yarısını kesintisiz geçer", () => {
    const s = [staff("a", [wh(3, H(23), H(25))])];
    const r = run({ date: D, staff: s, service: { durationMin: 60, bufferMin: 0 } });
    // 23:45'te başlayan 60 dk'lık randevu 00:45'te biter, vardiya 01:00'e kadar sürer → sığar
    expect(times(r)).toEqual(["23:00", "23:15", "23:30", "23:45"]);
  });
  it("taşan vardiya + molası ertesi güne düşer", () => {
    const s = [staff("a", [wh(3, H(22), H(26), [[H(24), H(25)]])])];
    const next = run({ date: "2026-06-04", staff: s });
    expect(times(next)).toEqual(["01:00", "01:15", "01:30"]);
  });
  it("vardiya taşması mevcut randevuyu da dikkate alır", () => {
    const s = [staff("a", [wh(3, H(22), H(26))])];
    const busy = [{ staffId: "a", startsAt: at("2026-06-04", H(0, 30)), blockedUntil: at("2026-06-04", H(1, 0)) }];
    const t = times(run({ date: "2026-06-04", staff: s, busy }));
    expect(t).not.toContain("00:30");
    expect(t).not.toContain("00:15");
    expect(t).toContain("00:00");
    expect(t).toContain("01:00");
  });
});

describe("birden çok personel / fark etmez", () => {
  const two = [staff("a", allDays(H(9), H(11))), staff("b", allDays(H(10), H(12)))];
  it("birleşim: her slot için uygun personel listesi", () => {
    const r = run({ date: D, staff: two });
    const m = new Map(times(r).map((t, i) => [t, r[i]?.staffIds]));
    expect(m.get("09:00")).toEqual(["a"]);
    expect(m.get("10:00")).toEqual(["a", "b"]);
    expect(m.get("11:30")).toEqual(["b"]); // b 12:00'a kadar, a 11:00'de bitti
    expect(m.get("10:45")).toEqual(["b"]); // a için 10:45+30 > 11:00
    expect(m.get("08:45")).toBeUndefined();
    expect(m.has("12:00")).toBe(false);
  });
  it("biri doluysa yalnız diğeri döner", () => {
    const busy = [{ staffId: "a", startsAt: at(D, H(10)), blockedUntil: at(D, H(10, 30)) }];
    const r = run({ date: D, staff: two, busy });
    const slot = r.find((s) => utcToLocal(s.start, TZ).minutes === H(10));
    expect(slot?.staffIds).toEqual(["b"]);
  });
  it("tek personel istenince yalnız onun slotları", () => {
    const r = run({ date: D, staff: [two[1] as StaffAvailabilityInput] });
    expect(times(r)[0]).toBe("10:00");
  });
});

describe("DST günü (Europe/Nicosia)", () => {
  const tz = "Europe/Nicosia";
  const tenant = { timeZone: tz, slotMinutes: 60, minLeadMinutes: 0, maxAdvanceDays: 365 };
  const now = new Date("2026-03-01T00:00:00Z");
  it("ilkbahar: 03:00–04:00 olmayan saat slot üretmez, geri kalanı doğru UTC anında", () => {
    const r = run({ date: "2026-03-29", tenant, now, service: { durationMin: 60, bufferMin: 0 }, staff: [staff("a", allDays(H(1), H(6)))] });
    expect(times(r, tz)).toEqual(["01:00", "02:00", "04:00", "05:00"]);
    expect(r.map((s) => s.start.toISOString())).toEqual([
      "2026-03-28T23:00:00.000Z", "2026-03-29T00:00:00.000Z", "2026-03-29T01:00:00.000Z", "2026-03-29T02:00:00.000Z",
    ]);
  });
  it("ilkbahar: 60 dk hizmet 02:00 slotu DST boşluğunu gerçek süre olarak yer (02:00–04:00 yerel)", () => {
    // 02:00 EET = 00:00Z; +60 dk = 01:00Z = 04:00 EEST. İş saati 04:00'te bitiyorsa sığar.
    const r = run({ date: "2026-03-29", tenant, now, service: { durationMin: 60, bufferMin: 0 }, staff: [staff("a", allDays(H(2), H(4)))] });
    expect(times(r, tz)).toEqual(["02:00"]);
  });
  it("sonbahar: 25 saatlik gün, çalışma saatleri duvar saatine göre", () => {
    const r = run({ date: "2026-10-25", tenant, now, service: { durationMin: 60, bufferMin: 0 }, staff: [staff("a", allDays(H(2), H(6)))] });
    expect(times(r, tz)).toEqual(["02:00", "03:00", "04:00", "05:00"]);
    expect(r.map((s) => s.start.toISOString())).toEqual([
      "2026-10-24T23:00:00.000Z", "2026-10-25T00:00:00.000Z", "2026-10-25T02:00:00.000Z", "2026-10-25T03:00:00.000Z",
    ]);
  });
  it("normal gün: UTC kayması doğru (kış +2, yaz +3)", () => {
    const w = run({ date: "2026-01-15", tenant, now: new Date("2026-01-01T00:00:00Z") });
    expect(w[0]?.start.toISOString()).toBe("2026-01-15T07:00:00.000Z");
    const s = run({ date: "2026-07-15", tenant, now });
    expect(s[0]?.start.toISOString()).toBe("2026-07-15T06:00:00.000Z");
  });
});
