import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
try { process.loadEnvFile(".env"); } catch { /* optional */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);
describe.skipIf(!HAS_DB)("OTP kötüye kullanım koruması (gerçek PostgreSQL)", () => {
  let db: typeof import("@/lib/db");
  let otp: typeof import("@/lib/otp");
  const ids: string[] = [];
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let n = 0;
  const now = new Date("2031-03-05T12:00:00Z");
  beforeAll(async () => { db = await import("@/lib/db"); otp = await import("@/lib/otp"); });
  async function salon() {
    const t = await db.prisma.tenant.create({ data: { slug: `otp-${uid}-${++n}`, name: "OTP test", city: "Girne" } });
    ids.push(t.id);
    const phone = "+905331234567";
    await db.prisma.customer.create({ data: { tenantId: t.id, phone, name: "Test" } });
    return { tenantId: t.id, phone, slug: t.slug };
  }
  afterAll(async () => { if (db) { await db.prisma.tenant.deleteMany({ where: { id: { in: ids } } }); await db.prisma.$disconnect(); } });
  it("eşzamanlı ve anlık yeniden istek tek SMS üretir; geçerli kod süresince korunur, süre sonunda yenilenebilir", async () => {
    const s = await salon(); let calls = 0;
    const send = async () => { calls++; };
    await Promise.all([otp.requestOtp(s.tenantId, s.phone, { now, send }), otp.requestOtp(s.tenantId, s.phone, { now, send })]);
    expect(calls).toBe(1);
    await otp.requestOtp(s.tenantId, s.phone, { now: new Date(+now + 61_000), send });
    expect(calls).toBe(1);
    await otp.requestOtp(s.tenantId, s.phone, { now: new Date(+now + otp.OTP_TTL_MS + 1), send });
    expect(calls).toBe(2);
  });
  it("kayıtlı teslim hatası ve kayıtsız numara aynı 200 yanıtına dönüşür", async () => {
    const s = await salon();
    const send = async () => { throw new otp.OtpDeliveryError(); };
    const known = await otp.requestOtp(s.tenantId, s.phone, { now, send });
    const unknown = await otp.requestOtp(s.tenantId, "+905331234568", { now, send });
    expect(known).toEqual({ sent: true }); expect(unknown).toEqual(known);
  });
  it("gerçek OTP HTTP ucu kayıtlı/kayıtsız numarayı sağlayıcıya dokunmadan aynı kuyruğa alır", async () => {
    const s = await salon();
    const { MemoryQueue, setQueue } = await import("@/jobs/queue"); const queue = new MemoryQueue(); setQueue(queue);
    const route = await import("@/app/api/public/[slug]/otp/request/route");
    const provider = await import("@/lib/messaging/send");
    const spy = vi.spyOn(provider, "sendMessage").mockRejectedValue(new Error("test sağlayıcı hatası"));
    const request = (phone: string) => route.POST(new Request(`http://localhost/api/public/${s.slug}/otp/request`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.71" }, body: JSON.stringify({ phone }),
    }), { params: Promise.resolve({ slug: s.slug }) });
    try {
      const known = await request(s.phone); const unknown = await request("+905331234568");
      expect(known.status).toBe(200); expect(unknown.status).toBe(200);
      expect(await known.json()).toEqual(await unknown.json());
      expect(queue.jobs).toHaveLength(2); expect(spy).not.toHaveBeenCalled();
      expect(await db.prisma.otp.count({ where: { tenantId: s.tenantId } })).toBe(0);
    } finally { spy.mockRestore(); setQueue(null); }
  });
  it("migration öncesi 0 rezervasyonlu OTP kayıtları da günlük tavana sayılır", async () => {
    const s = await salon(); let calls = 0;
    await db.prisma.otp.createMany({ data: Array.from({ length: 30 }, (_, i) => ({
      tenantId: s.tenantId, phone: `+90533124${String(4500 + i)}`, codeHash: "legacy-test", createdAt: now,
      expiresAt: new Date(+now + 300_000), reservedSegments: 0,
    })) });
    await otp.requestOtp(s.tenantId, s.phone, { now, send: async () => { calls++; } });
    expect(calls).toBe(0);
  });
  it("farklı numaraların paralel istekleri salonun günlük segment tavanını aşamaz", async () => {
    const s = await salon(); let calls = 0;
    const phones = Array.from({ length: 35 }, (_, i) => `+90533123${String(4500 + i)}`);
    await db.prisma.customer.createMany({ data: phones.map((phone) => ({ tenantId: s.tenantId, phone, name: "Test" })) });
    await Promise.all(phones.map((phone) => otp.requestOtp(s.tenantId, phone, { now, send: async () => { calls++; } })));
    expect(calls).toBeGreaterThan(0); expect(calls).toBeLessThanOrEqual(30);
    expect(await db.prisma.otp.count({ where: { tenantId: s.tenantId } })).toBe(calls);
    const reserved = await db.prisma.otp.aggregate({ where: { tenantId: s.tenantId }, _sum: { reservedSegments: true } });
    expect(reserved._sum.reservedSegments).toBeLessThanOrEqual(otp.OTP_DAILY_SEGMENT_CAP);
    let nextDayCalls = 0;
    await otp.requestOtp(s.tenantId, phones[0]!, { now: new Date(+now + 86_400_000), send: async () => { nextDayCalls++; } });
    expect(nextDayCalls).toBe(1);
  });
});
