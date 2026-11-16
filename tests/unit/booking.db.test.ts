import { afterAll, beforeAll, describe, expect, it } from "vitest";

// .env'deki DATABASE_URL'yi yükle (yoksa test atlanır)
try { process.loadEnvFile(".env"); } catch { /* .env yok */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("rezervasyon (gerçek DB)", () => {
  const slug = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const state = {} as {
    tenantId: string; otherTenantId: string; staffA: string; staffB: string; otherStaff: string;
    service: string; date: string; mod: typeof import("@/lib/booking"); dbmod: typeof import("@/lib/db"); time: typeof import("@/lib/time");
  };
  const start = (min: number) => state.time.zonedToUtc(state.date, min, "Asia/Famagusta");
  const cust = (phone: string, name = "Ayşe") => ({ name, phone });

  beforeAll(async () => {
    state.mod = await import("@/lib/booking");
    state.dbmod = await import("@/lib/db");
    state.time = await import("@/lib/time");
    const { prisma } = state.dbmod;
    state.date = state.time.addDays(state.time.utcToLocal(new Date(), "Asia/Famagusta").date, 3);
    const mk = async (s: string) => {
      const t = await prisma.tenant.create({ data: { slug: s, name: s, city: "Lefkoşa", timeZone: "Asia/Famagusta", cancelHoursBefore: 2, minLeadMinutes: 0 } });
      const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ tenantId: t.id, weekday, startMin: 540, endMin: 1080, breaks: [[780, 840]] }));
      const a = await prisma.staff.create({ data: { tenantId: t.id, name: "A", sortOrder: 0 } });
      const b = await prisma.staff.create({ data: { tenantId: t.id, name: "B", sortOrder: 1 } });
      const svc = await prisma.service.create({ data: { tenantId: t.id, nameTr: "Saç", durationMin: 30, bufferMin: 15, priceTry: "500" } });
      await prisma.serviceStaff.createMany({ data: [{ tenantId: t.id, serviceId: svc.id, staffId: a.id }, { tenantId: t.id, serviceId: svc.id, staffId: b.id }] });
      await prisma.workingHours.createMany({ data: [a.id, b.id].flatMap((staffId) => hours.map((h) => ({ ...h, staffId }))) });
      return { t, a, b, svc };
    };
    const main = await mk(slug);
    const other = await mk(`${slug}-b`);
    Object.assign(state, { tenantId: main.t.id, otherTenantId: other.t.id, staffA: main.a.id, staffB: main.b.id, otherStaff: other.a.id, service: main.svc.id });
  });

  afterAll(async () => {
    if (!HAS_DB || !state.dbmod) return;
    const { prisma } = state.dbmod;
    const ids = [state.tenantId, state.otherTenantId].filter(Boolean);
    await prisma.appointment.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("randevu oluşturur: bitiş, tampon, fiyat, token, müşteri E.164", async () => {
    const { createAppointment } = state.mod;
    const a = await createAppointment(state.dbmod.withTenant(state.tenantId), {
      tenantId: state.tenantId, serviceId: state.service, staffId: state.staffA, startsAt: start(600), customer: cust("0533 111 22 33"),
    });
    expect(a.endsAt).toEqual(start(630));
    expect(a.blockedUntil).toEqual(start(645));
    expect(Number(a.priceTry)).toBe(500);
    expect(a.status).toBe("confirmed");
    expect(a.cancelToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const c = await state.dbmod.prisma.customer.findFirstOrThrow({ where: { id: a.customerId } });
    expect(c.phone).toBe("+905331112233");
    // aynı telefon → aynı müşteri
    const a2 = await createAppointment(state.dbmod.withTenant(state.tenantId), {
      tenantId: state.tenantId, serviceId: state.service, staffId: state.staffA, startsAt: start(645), customer: cust("+90 533 111 22 33", "Ayşe K."),
    });
    expect(a2.customerId).toBe(a.customerId); // 10:45 tam tampon bitiminde serbest
  });

  it("tampon içine ve kural dışı saate randevu verilmez", async () => {
    const { createAppointment, SlotTakenError, SlotUnavailableError } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    const base = { tenantId: state.tenantId, serviceId: state.service, staffId: state.staffA, customer: cust("0542 222 33 44") };
    await expect(createAppointment(db, { ...base, startsAt: start(615) })).rejects.toBeInstanceOf(SlotTakenError);
    await expect(createAppointment(db, { ...base, startsAt: start(780) })).rejects.toBeInstanceOf(SlotUnavailableError); // mola
    await expect(createAppointment(db, { ...base, startsAt: start(600 + 7), customer: cust("0542 222 33 44") })).rejects.toBeInstanceOf(SlotUnavailableError); // slot ızgarası dışı
    await expect(createAppointment(db, { ...base, startsAt: start(600), customer: cust("123") })).rejects.toBeInstanceOf(state.mod.InvalidPhoneError);
  });

  it("eşzamanlı aynı slot: tam bir başarı + bir SlotTakenError (aynı telefon)", async () => {
    const { createAppointment, SlotTakenError } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    const mkIn = () => createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: state.staffB, startsAt: start(660), customer: cust("0548 555 66 77") });
    const res = await Promise.allSettled([mkIn(), mkIn()]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = res.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rej).toHaveLength(1);
    expect(rej[0]?.reason).toBeInstanceOf(SlotTakenError);
  });

  it("eşzamanlı aynı slot, farklı telefonlar: DB exclusion constraint SlotTakenError'a çevrilir", async () => {
    const { createAppointment, SlotTakenError } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    const mkIn = (phone: string) => createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: state.staffB, startsAt: start(720), customer: cust(phone) });
    const res = await Promise.allSettled([mkIn("0533 000 00 01"), mkIn("0533 000 00 02"), mkIn("0533 000 00 03")]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of res) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(SlotTakenError);
    const n = await state.dbmod.prisma.appointment.count({ where: { staffId: state.staffB, startsAt: start(720) } });
    expect(n).toBe(1);
  });

  it("'fark etmez': o gün en az randevusu olan personel seçilir; eşzamanlıda ikisi de farklı personele düşer", async () => {
    const { createAppointment } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    // A'nın o gün 2, B'nin 2 randevusu var (önceki testler) → eşitlik: sıra (A). Önce B'ye bir tane daha, sonra A az kalsın
    const before = await state.dbmod.prisma.appointment.groupBy({ by: ["staffId"], where: { tenantId: state.tenantId, status: "confirmed" }, _count: true });
    const cnt = (id: string) => before.find((g) => g.staffId === id)?._count ?? 0;
    const expected = cnt(state.staffA) <= cnt(state.staffB) ? state.staffA : state.staffB;
    const a = await createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: "any", startsAt: start(900), customer: cust("0539 888 99 00") });
    expect(a.staffId).toBe(expected);
    // aynı slota iki "any" → farklı personel
    const res = await Promise.all([1, 2].map((i) => createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: "any", startsAt: start(960), customer: cust(`0533 900 00 0${i}`) })));
    expect(new Set(res.map((r) => r.staffId)).size).toBe(2);
    // üçüncüsü: slot dolu
    await expect(createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: "any", startsAt: start(960), customer: cust("0533 900 00 09") })).rejects.toBeInstanceOf(state.mod.SlotTakenError);
  });

  it("başka salonun personeli/hizmeti bu salonda kullanılamaz", async () => {
    const { createAppointment, NotFoundError } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    const base = { tenantId: state.tenantId, startsAt: start(1020), customer: cust("0533 123 00 00") };
    await expect(createAppointment(db, { ...base, serviceId: state.service, staffId: state.otherStaff })).rejects.toBeInstanceOf(NotFoundError);
    const otherSvc = await state.dbmod.prisma.service.findFirstOrThrow({ where: { tenantId: state.otherTenantId } });
    await expect(createAppointment(db, { ...base, serviceId: otherSvc.id, staffId: state.staffA })).rejects.toBeInstanceOf(NotFoundError);
    // diğer salonun istemcisi de bizim personelimizi göremez
    const otherDb = state.dbmod.withTenant(state.otherTenantId);
    await expect(createAppointment(otherDb, { ...base, tenantId: state.otherTenantId, serviceId: otherSvc.id, staffId: state.staffA })).rejects.toBeInstanceOf(NotFoundError);
    expect(await state.dbmod.prisma.appointment.count({ where: { staffId: state.otherStaff } })).toBe(0);
  });

  it("personel o hizmeti yapmıyorsa reddedilir", async () => {
    const { createAppointment, NotFoundError } = state.mod;
    const { prisma } = state.dbmod;
    const svc2 = await prisma.service.create({ data: { tenantId: state.tenantId, nameTr: "Boya", durationMin: 60, priceTry: "900" } });
    await prisma.serviceStaff.create({ data: { tenantId: state.tenantId, serviceId: svc2.id, staffId: state.staffB } });
    await expect(createAppointment(state.dbmod.withTenant(state.tenantId), {
      tenantId: state.tenantId, serviceId: svc2.id, staffId: state.staffA, startsAt: start(1000), customer: cust("0533 321 00 00"),
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("iptal kuralı: süre yetmezse reddedilir, yetiyorsa iptal olur, ikinci kez AlreadyClosed", async () => {
    const { createAppointment, cancelByToken, CancelWindowError, AlreadyClosedError, NotFoundError } = state.mod;
    const db = state.dbmod.withTenant(state.tenantId);
    const a = await createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: state.staffA, startsAt: start(1035), customer: cust("0533 777 00 11") });
    // randevuya 1 saat kala → 2 saat kuralı engeller
    await expect(cancelByToken(a.cancelToken, new Date(a.startsAt.getTime() - 3_600_000))).rejects.toBeInstanceOf(CancelWindowError);
    expect((await state.dbmod.prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("confirmed");
    // 2 saat kala (sınır) serbest
    const done = await cancelByToken(a.cancelToken, new Date(a.startsAt.getTime() - 2 * 3_600_000));
    expect(done.status).toBe("cancelled_by_customer");
    expect(done.cancelledAt).not.toBeNull();
    await expect(cancelByToken(a.cancelToken, new Date())).rejects.toBeInstanceOf(AlreadyClosedError);
    await expect(cancelByToken("yok-boyle-bir-token-1234567890", new Date())).rejects.toBeInstanceOf(NotFoundError);
    // iptal edilen slot tekrar alınabilir
    const again = await createAppointment(db, { tenantId: state.tenantId, serviceId: state.service, staffId: state.staffA, startsAt: start(1035), customer: cust("0533 777 00 22") });
    expect(again.id).not.toBe(a.id);
  });
});
