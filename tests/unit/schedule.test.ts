import { describe, expect, it } from "vitest";
import { isQuietHour, planReminders, reminderKey } from "@/lib/messaging/schedule";
import { MemoryQueue } from "@/jobs/queue";

const now = new Date("2026-11-17T08:00:00Z");
const inMin = (m: number) => new Date(now.getTime() + m * 60_000);
const appt = (m: number, status = "confirmed") => ({ id: "ap1", startsAt: inMin(m), status });

describe("planReminders", () => {
  it("her ofset için startsAt - ofset zamanında iş planlar", () => {
    const p = planReminders(appt(3000), { reminderOffsets: [1440, 120] }, now);
    expect(p.map((x) => x.offsetMin)).toEqual([1440, 120]);
    expect(p[0]!.runAt).toEqual(inMin(3000 - 1440));
    expect(p[1]!.runAt).toEqual(inMin(3000 - 120));
  });
  it("anahtar rem:{id}:{ofset}:{startsAt ISO}", () => {
    const a = appt(3000);
    const [p] = planReminders(a, { reminderOffsets: [1440] }, now);
    expect(p!.key).toBe(`rem:ap1:1440:${a.startsAt.toISOString()}`);
    expect(p!.key).toBe(reminderKey("ap1", 1440, a.startsAt));
  });
  it("taşınınca anahtarlar değişir (eski işler geçersiz olur)", () => {
    const a = planReminders(appt(3000), { reminderOffsets: [120] }, now)[0]!.key;
    const b = planReminders(appt(3060), { reminderOffsets: [120] }, now)[0]!.key;
    expect(a).not.toBe(b);
  });
  it("zamanı geçmiş ofsetler atlanır (1 saat sonraki randevuda 24s ve 2s yok)", () => {
    expect(planReminders(appt(60), { reminderOffsets: [1440, 120] }, now)).toEqual([]);
    expect(planReminders(appt(180), { reminderOffsets: [1440, 120] }, now).map((x) => x.offsetMin)).toEqual([120]);
  });
  it("tam şu ana denk gelen ofset atlanır (runAt <= now)", () => {
    expect(planReminders(appt(120), { reminderOffsets: [120] }, now)).toEqual([]);
    expect(planReminders(appt(121), { reminderOffsets: [120] }, now)).toHaveLength(1);
  });
  it("iptal/tamamlandı/gelmedi planlanmaz; pending planlanır", () => {
    for (const s of ["cancelled_by_customer", "cancelled_by_salon", "completed", "no_show"]) {
      expect(planReminders(appt(3000, s), { reminderOffsets: [120] }, now)).toEqual([]);
    }
    expect(planReminders(appt(3000, "pending"), { reminderOffsets: [120] }, now)).toHaveLength(1);
  });
  it("geçmiş randevu, tekrarlı/geçersiz ofset", () => {
    expect(planReminders(appt(-10), { reminderOffsets: [120] }, now)).toEqual([]);
    expect(planReminders(appt(3000), { reminderOffsets: [120, 120, 0, -5] }, now)).toHaveLength(1);
  });
});

describe("isQuietHour", () => {
  const tz = "Asia/Famagusta"; // kış UTC+2
  const at = (utcH: number) => new Date(Date.UTC(2026, 10, 17, utcH, 0));
  it("22–08 gece yarısını aşar", () => {
    expect(isQuietHour(at(20), tz, 22, 8)).toBe(true); // 22:00 yerel
    expect(isQuietHour(at(19), tz, 22, 8)).toBe(false); // 21:00
    expect(isQuietHour(at(22), tz, 22, 8)).toBe(true); // 00:00
    expect(isQuietHour(at(5), tz, 22, 8)).toBe(true); // 07:00
    expect(isQuietHour(at(6), tz, 22, 8)).toBe(false); // 08:00 bitiş dahil değil
  });
  it("aynı gün aralığı ve eşit saat", () => {
    expect(isQuietHour(at(10), tz, 12, 14)).toBe(true); // 12:00
    expect(isQuietHour(at(12), tz, 12, 14)).toBe(false); // 14:00
    expect(isQuietHour(at(10), tz, 5, 5)).toBe(false);
  });
  it("saat dilimi: aynı an farklı bölgede farklı", () => {
    expect(isQuietHour(at(20), "UTC", 22, 8)).toBe(false);
    expect(isQuietHour(at(20), "Asia/Famagusta", 22, 8)).toBe(true);
  });
});

describe("MemoryQueue", () => {
  it("aynı singletonKey ikinci kez eklenmez", async () => {
    const q = new MemoryQueue();
    expect(await q.enqueue("send-reminder", {}, { singletonKey: "k" })).not.toBeNull();
    expect(await q.enqueue("send-reminder", {}, { singletonKey: "k" })).toBeNull();
    expect(q.jobs).toHaveLength(1);
  });
});
