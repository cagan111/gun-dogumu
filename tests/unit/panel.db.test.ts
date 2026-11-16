import { afterAll, beforeAll, describe, expect, it } from "vitest";

try { process.loadEnvFile(".env"); } catch { /* .env yok */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);
const TZ = "Asia/Famagusta";

describe.skipIf(!HAS_DB)("panel API servisleri (gerçek DB)", () => {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const M = {} as {
    db: typeof import("@/lib/db"); signup: typeof import("@/lib/signup"); sess: typeof import("@/lib/session");
    appts: typeof import("@/lib/panel/appointments"); cat: typeof import("@/lib/panel/catalog");
    cust: typeof import("@/lib/panel/customers"); set: typeof import("@/lib/panel/settings"); rep: typeof import("@/lib/panel/reports");
    time: typeof import("@/lib/time"); pub: typeof import("@/lib/public");
    A: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>; B: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>;
    ownerA: Awaited<ReturnType<typeof import("@/lib/session").resolveTenantUser>>;
    staffA: Awaited<ReturnType<typeof import("@/lib/session").resolveTenantUser>>;
    ownerB: Awaited<ReturnType<typeof import("@/lib/session").resolveTenantUser>>;
    date: string; svcA: string; stfA: string; svcB: string; stfB: string; apptB: string; custB: string;
  };
  const mk = (slug: string, email: string) => ({ email, password: "supersecret1", name: "Sahip", salonName: slug, city: "Girne" as const, slug });
  const at = (min: number) => M.time.zonedToUtc(M.date, min, TZ);

  beforeAll(async () => {
    M.db = await import("@/lib/db"); M.signup = await import("@/lib/signup"); M.sess = await import("@/lib/session");
    M.appts = await import("@/lib/panel/appointments"); M.cat = await import("@/lib/panel/catalog");
    M.cust = await import("@/lib/panel/customers"); M.set = await import("@/lib/panel/settings"); M.rep = await import("@/lib/panel/reports");
    M.time = await import("@/lib/time"); M.pub = await import("@/lib/public");
    const { prisma } = M.db;
    M.A = await M.signup.signupSalon(mk(`p-${uid}-a`, `pa-${uid}@example.test`));
    M.B = await M.signup.signupSalon(mk(`p-${uid}-b`, `pb-${uid}@example.test`));
    const staffUser = await prisma.user.create({ data: { email: `ps-${uid}@example.test`, name: "Personel", role: "staff", tenantId: M.A.tenantId } });
    M.ownerA = await M.sess.resolveTenantUser({ user: { id: M.A.userId, role: "owner", tenantId: M.A.tenantId } });
    M.staffA = await M.sess.resolveTenantUser({ user: { id: staffUser.id, role: "staff", tenantId: M.A.tenantId } });
    M.ownerB = await M.sess.resolveTenantUser({ user: { id: M.B.userId, role: "owner", tenantId: M.B.tenantId } });
    M.date = M.time.addDays(M.time.utcToLocal(new Date(), TZ).date, 2);
    // A: pro plan (5 personel), uzun minLead (online rezervasyon bu tarihe kapalı)
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "pro", minLeadMinutes: 10_080, maxAdvanceDays: 1 } });
    const st = await M.cat.createStaff(M.ownerA, { name: "Ali", color: "#2563eb", active: true, sortOrder: 0 });
    M.stfA = st.id;
    const sv = await M.cat.createService(M.ownerA, { nameTr: "Saç", durationMin: 30, priceTry: 400, bufferMin: 0, active: true, sortOrder: 0, staffIds: [st.id] });
    M.svcA = sv.id;
    await M.cat.setWorkingHours(M.ownerA, st.id, { days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 540, endMin: 1080, breaks: [[780, 840]] as [number, number][] })) });
    // B: bir randevu
    const bs = await prisma.staff.create({ data: { tenantId: M.B.tenantId, name: "Bora" } });
    const bsv = await prisma.service.create({ data: { tenantId: M.B.tenantId, nameTr: "Sakal", durationMin: 30, priceTry: "200" } });
    const bc = await prisma.customer.create({ data: { tenantId: M.B.tenantId, name: "Başka Müşteri", phone: "+905331110099" } });
    const ap = await prisma.appointment.create({ data: { tenantId: M.B.tenantId, staffId: bs.id, serviceId: bsv.id, customerId: bc.id, startsAt: at(600), endsAt: at(630), blockedUntil: at(630), cancelToken: `tok-${uid}-bbbbbbbbbbbbbbbbb`, priceTry: "200" } });
    M.stfB = bs.id; M.svcB = bsv.id; M.apptB = ap.id; M.custB = bc.id;
  });

  afterAll(async () => {
    if (!M.db) return;
    const { prisma } = M.db;
    const ids = [M.A?.tenantId, M.B?.tenantId].filter(Boolean) as string[];
    await prisma.appointment.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  const cust = (n: number, name = "Deniz") => ({ name, phone: `+90533222${String(1000 + n)}` });
  const create = (min: number, n: number, extra: Record<string, unknown> = {}) =>
    M.appts.createPanelAppointment(M.ownerA, M.appts.createSchema.parse({ serviceId: M.svcA, staffId: M.stfA, startsAt: at(min).toISOString(), customer: cust(n), ...extra }));

  it("staff rolü hizmet/personel/saat/ayar/SMS talebi yazamaz (403); okuyabilir", async () => {
    const forbidden = { code: "forbidden" };
    await expect(M.cat.createService(M.staffA, M.cat.serviceSchema.parse({ nameTr: "X", durationMin: 30, priceTry: 1 }))).rejects.toMatchObject(forbidden);
    await expect(M.cat.updateService(M.staffA, M.svcA, { nameTr: "Y" })).rejects.toMatchObject(forbidden);
    await expect(M.cat.deleteService(M.staffA, M.svcA)).rejects.toMatchObject(forbidden);
    await expect(M.cat.createStaff(M.staffA, M.cat.staffSchema.parse({ name: "Z" }))).rejects.toMatchObject(forbidden);
    await expect(M.cat.setWorkingHours(M.staffA, M.stfA, { days: [] })).rejects.toMatchObject(forbidden);
    await expect(M.cat.createTimeOff(M.staffA, { staffId: M.stfA, startsAt: at(600), endsAt: at(700), kind: "leave" })).rejects.toMatchObject(forbidden);
    await expect(M.set.updateSettings(M.staffA, { cancelHoursBefore: 5 })).rejects.toMatchObject(forbidden);
    await expect(M.set.createSmsRequest(M.staffA, { size: 500 })).rejects.toMatchObject(forbidden);
    expect((await M.cat.listServices(M.staffA)).length).toBe(1);
    expect((await M.set.getSettings(M.staffA)).cancelHoursBefore).toBe(2);
    expect((await M.set.getSmsBalance(M.staffA)).balance).toBe(100);
  });

  it("A salonu B'nin hizmet/personelini göremez, değiştiremez (404); hizmete yabancı personel verilemez", async () => {
    await expect(M.cat.getService(M.ownerA, M.svcB)).rejects.toMatchObject({ code: "not_found" });
    await expect(M.cat.updateService(M.ownerA, M.svcB, { nameTr: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(M.cat.updateStaff(M.ownerA, M.stfB, { name: "x" })).rejects.toMatchObject({ code: "not_found" });
    await expect(M.cat.deleteStaff(M.ownerA, M.stfB)).rejects.toMatchObject({ code: "not_found" });
    await expect(M.cat.setWorkingHours(M.ownerA, M.stfB, { days: [] })).rejects.toMatchObject({ code: "not_found" });
    await expect(M.cat.updateService(M.ownerA, M.svcA, { staffIds: [M.stfB] })).rejects.toMatchObject({ code: "not_found" });
    expect((await M.cat.listStaff(M.ownerA)).map((s) => s.id)).not.toContain(M.stfB);
  });

  it("tenant A, B'nin randevusunu okuyamaz / taşıyamaz / durumunu değiştiremez (404)", async () => {
    await expect(M.appts.getAppointment(M.ownerA, M.apptB)).rejects.toMatchObject({ code: "not_found" });
    await expect(M.appts.moveAppointment(M.ownerA, M.apptB, { startsAt: at(660) })).rejects.toMatchObject({ code: "not_found" });
    await expect(M.appts.setAppointmentStatus(M.ownerA, M.apptB, "no_show")).rejects.toMatchObject({ code: "not_found" });
    const list = await M.appts.listAppointments(M.ownerA, { from: M.date, to: M.date });
    expect(list.appointments.some((a) => a.id === M.apptB)).toBe(false);
    const { prisma } = M.db;
    const b = await prisma.appointment.findUniqueOrThrow({ where: { id: M.apptB } });
    expect(b.status).toBe("confirmed");
    expect(b.startsAt.getTime()).toBe(at(600).getTime());
    await expect(M.cust.getCustomer(M.ownerA, M.custB)).rejects.toMatchObject({ code: "not_found" });
  });

  it("panelden randevu en erken kuralını atlar (online atlayamaz) ama çakışmayı asla", async () => {
    await expect(M.pub.bookPublic(`p-${uid}-a`, { serviceId: M.svcA, staffId: M.stfA, startsAt: at(600), customer: { name: "Online", phone: "+905332229999" }, kvkkAccepted: true, marketingConsent: false })).rejects.toMatchObject({ code: "slot_unavailable" });
    const a = await create(600, 1);
    expect(a.source).toBe("panel");
    expect(a.status).toBe("confirmed");
    await expect(create(600, 2)).rejects.toMatchObject({ code: "slot_taken" });
    await expect(create(615, 3, { source: "walk_in" })).rejects.toMatchObject({ code: "slot_taken" }); // 5 dk ızgarada ama çakışıyor
    await expect(create(780, 4)).rejects.toMatchObject({ code: "slot_unavailable" }); // mola
    await expect(create(1090, 5)).rejects.toMatchObject({ code: "slot_unavailable" }); // mesai dışı
    const w = await create(635, 6, { source: "walk_in" });
    expect(w.source).toBe("walk_in");
  });

  it("taşıma: yeni saat doğrulanır, çakışma 409, kendi eski yeri engel değil, yabancı personel 404", async () => {
    const a = await create(670, 10);
    const b = await create(720, 11);
    await expect(M.appts.moveAppointment(M.ownerA, a.id, { startsAt: at(720) })).rejects.toMatchObject({ code: "slot_taken" });
    await expect(M.appts.moveAppointment(M.ownerA, a.id, { startsAt: at(790) })).rejects.toMatchObject({ code: "slot_unavailable" });
    const moved = await M.appts.moveAppointment(M.ownerA, a.id, { startsAt: at(680) }); // kendisiyle örtüşen eski yerle çakışmaz
    expect(new Date(moved.startsAt as Date).getTime()).toBe(at(680).getTime());
    expect(new Date(moved.endsAt as Date).getTime()).toBe(at(710).getTime());
    await expect(M.appts.moveAppointment(M.ownerA, b.id, { startsAt: at(720), staffId: M.stfB })).rejects.toMatchObject({ code: "not_found" });
    await M.appts.setAppointmentStatus(M.ownerA, b.id, "cancelled_by_salon");
    await expect(M.appts.moveAppointment(M.ownerA, b.id, { startsAt: at(900) })).rejects.toMatchObject({ code: "already_closed" });
  });

  it("gelmedi sayacı: artar, tekrarda artmaz, geri alınca azalır; iptal alanı", async () => {
    const { prisma } = M.db;
    const a = await create(840, 20);
    const cid = (a.customer as { id: string }).id;
    const count = async () => (await prisma.customer.findUniqueOrThrow({ where: { id: cid } })).noShowCount;
    await M.appts.setAppointmentStatus(M.ownerA, a.id, "no_show");
    expect(await count()).toBe(1);
    await M.appts.setAppointmentStatus(M.ownerA, a.id, "no_show");
    expect(await count()).toBe(1);
    await M.appts.setAppointmentStatus(M.staffA, a.id, "confirmed"); // staff durum değiştirebilir
    expect(await count()).toBe(0);
    await M.appts.setAppointmentStatus(M.ownerA, a.id, "no_show");
    await M.appts.setAppointmentStatus(M.ownerA, a.id, "completed");
    expect(await count()).toBe(0);
    const c = await M.appts.setAppointmentStatus(M.ownerA, a.id, "cancelled_by_salon");
    expect(c.cancelledAt).toBeInstanceOf(Date);
    const detail = await M.cust.getCustomer(M.ownerA, cid);
    expect(detail.noShowCount).toBe(0);
    expect(detail.past.length + detail.upcoming.length).toBe(1);
  });

  it("plan maxStaff: Başlangıç 1, Pro 5; aktifleştirme de sınırlı; Salon+ sınırsız", async () => {
    const { prisma } = M.db;
    const s = (name: string) => M.cat.createStaff(M.ownerA, M.cat.staffSchema.parse({ name }));
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "baslangic" } });
    await expect(s("İkinci")).rejects.toMatchObject({ code: "plan_limit", limit: 1 });
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "pro" } });
    for (const n of ["P2", "P3", "P4"]) await s(n);
    const p5 = await s("P5");
    await expect(s("P6")).rejects.toMatchObject({ code: "plan_limit" });
    await M.cat.updateStaff(M.ownerA, p5.id, { active: false });
    const p6 = await s("P6"); // pasifler sayılmaz
    await expect(M.cat.updateStaff(M.ownerA, p5.id, { active: true })).rejects.toMatchObject({ code: "plan_limit" });
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "salon_plus" } });
    await M.cat.updateStaff(M.ownerA, p5.id, { active: true });
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "pro" } });
    void p6;
  });

  it("randevusu olan hizmet/personel silinmez, pasifleşir; boş olan silinir", async () => {
    const empty = await M.cat.createService(M.ownerA, M.cat.serviceSchema.parse({ nameTr: "Boş", durationMin: 20, priceTry: 10 }));
    expect(await M.cat.deleteService(M.ownerA, empty.id as string)).toEqual({ deleted: true, archived: false });
    const extra = await M.cat.createService(M.ownerA, M.cat.serviceSchema.parse({ nameTr: "Kullanılan", durationMin: 30, priceTry: 10, staffIds: [M.stfA] }));
    await M.appts.createPanelAppointment(M.ownerA, M.appts.createSchema.parse({ serviceId: extra.id, staffId: M.stfA, startsAt: at(900).toISOString(), customer: cust(30) }));
    expect(await M.cat.deleteService(M.ownerA, extra.id as string)).toEqual({ deleted: false, archived: true });
    expect((await M.cat.getService(M.ownerA, extra.id as string)).active).toBe(false);
  });

  it("çalışma saati: geçersiz mola reddedilir ve eski saatler korunur; izin ekle/sil", async () => {
    await expect(M.cat.setWorkingHours(M.ownerA, M.stfA, { days: [{ weekday: 1, startMin: 540, endMin: 1080, breaks: [[500, 600]] }] })).rejects.toMatchObject({ code: "validation" });
    expect((await M.cat.getWorkingHours(M.ownerA, M.stfA)).days).toHaveLength(7);
    const to = await M.cat.createTimeOff(M.ownerA, { staffId: M.stfA, startsAt: at(1000), endsAt: at(1060), kind: "leave", reason: "Doktor" });
    await expect(M.cat.createTimeOff(M.ownerA, { staffId: M.stfA, startsAt: at(1060), endsAt: at(1000), kind: "leave" })).rejects.toMatchObject({ code: "validation" });
    expect((await M.cat.listTimeOff(M.ownerA, { staffId: M.stfA })).length).toBe(1);
    await expect(create(1010, 40)).rejects.toMatchObject({ code: "slot_unavailable" }); // izin
    expect(await M.cat.deleteTimeOff(M.ownerA, to.id)).toEqual({ deleted: true });
    await expect(M.cat.deleteTimeOff(M.ownerB, to.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("müşteri araması (ad/telefon, sayfalı) ve notlar: Başlangıç 402, Pro ok, tenant izolasyonu", async () => {
    const { prisma } = M.db;
    const r1 = await M.cust.searchCustomers(M.ownerA, M.cust.customerQuerySchema.parse({ q: "dEn" }));
    expect(r1.total).toBeGreaterThan(0);
    const r2 = await M.cust.searchCustomers(M.ownerA, M.cust.customerQuerySchema.parse({ q: "22210" }));
    expect(r2.total).toBe(r1.total);
    const p1 = await M.cust.searchCustomers(M.ownerA, M.cust.customerQuerySchema.parse({ pageSize: 2 }));
    expect(p1.customers.length).toBe(2);
    expect(p1.total).toBeGreaterThan(2);
    const p2 = await M.cust.searchCustomers(M.ownerA, M.cust.customerQuerySchema.parse({ pageSize: 2, page: 2 }));
    expect(p2.customers[0]?.id).not.toBe(p1.customers[0]?.id);
    expect((await M.cust.searchCustomers(M.ownerA, M.cust.customerQuerySchema.parse({ q: "Başka Müşteri" }))).total).toBe(0);
    const cid = p1.customers[0]!.id;
    await M.cust.updateCustomerNotes(M.ownerA, cid, { notes: "Alerjisi var" });
    expect((await M.cust.getCustomer(M.ownerA, cid)).notes).toBe("Alerjisi var");
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "baslangic" } });
    await expect(M.cust.updateCustomerNotes(M.ownerA, cid, { notes: "x" })).rejects.toMatchObject({ code: "plan_feature" });
    const d = await M.cust.getCustomer(M.ownerA, cid);
    expect(d.notesEnabled).toBe(false);
    expect(d.notes).toBeNull();
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "pro" } });
    await expect(M.cust.updateCustomerNotes(M.ownerB, cid, { notes: "x" })).rejects.toMatchObject({ code: "plan_feature" }); // B Başlangıç
  });

  it("ayarlar: owner günceller, hatırlatmalar büyükten küçüğe sıralanır; SMS talebi ve bakiye", async () => {
    const r = await M.set.updateSettings(M.ownerA, M.set.settingsSchema.parse({ smsSenderName: "Glow Kuafor", reminderOffsets: [120, 1440], slotMinutes: 30, brandColor: "#112233", cancelHoursBefore: 6 }));
    expect(r.reminderOffsets).toEqual([1440, 120]);
    expect(r.slotMinutes).toBe(30);
    expect(r.smsSenderName).toBe("Glow Kuafor");
    const req = await M.set.createSmsRequest(M.ownerA, { size: 1000 });
    expect(req.status).toBe("open");
    await expect(M.set.createSmsRequest(M.ownerA, { size: 1000 })).rejects.toMatchObject({ code: "conflict" });
    expect((await M.set.listSmsRequests(M.ownerB)).length).toBe(0);
  });

  it("rapor: Başlangıç 402; Pro'da sayılar, ciro, en çok hizmet, gelmeme oranı", async () => {
    const { prisma } = M.db;
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "baslangic" } });
    await expect(M.rep.monthlyReport(M.ownerA, M.date.slice(0, 7))).rejects.toMatchObject({ code: "plan_feature" });
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { plan: "pro" } });
    const month = M.date.slice(0, 7);
    const now = new Date(at(1200).getTime() + 7 * 86_400_000); // randevulardan 1 hafta sonrası: onaylı olanlar "geçmiş"
    // ay içindeki bu hesap randevularını durumlara dağıt
    const all = await prisma.appointment.findMany({ where: { tenantId: M.A.tenantId } });
    const rep = await M.rep.monthlyReport(M.ownerA, month, now);
    const inMonth = all.filter((a) => a.startsAt.toISOString().slice(0, 7) === month || M.time.utcToLocal(a.startsAt, TZ).date.slice(0, 7) === month);
    expect(rep.total).toBe(inMonth.length);
    const completed = inMonth.filter((a) => a.status === "completed" || a.status === "confirmed");
    expect(rep.revenueTry).toBe(completed.reduce((s, a) => s + Number(a.priceTry), 0));
    expect(rep.topServices[0]?.serviceId).toBe(M.svcA);
    const noShow = inMonth.filter((a) => a.status === "no_show").length;
    const att = noShow + inMonth.filter((a) => a.status === "completed").length;
    expect(rep.noShowRate).toBeCloseTo(att ? noShow / att : 0);
    await expect(M.rep.monthlyReport(M.ownerA, "2026-13")).rejects.toMatchObject({ code: "validation" });
    // geçmiş onaylılar sayılır, gelecekteki sayılmaz
    const early = await M.rep.monthlyReport(M.ownerA, month, new Date(at(0).getTime() - 86_400_000));
    expect(early.revenueTry).toBe(inMonth.filter((a) => a.status === "completed").reduce((s, a) => s + Number(a.priceTry), 0));
  });

  it("KVKK onay zamanı public rezervasyonda müşteriye yazılır", async () => {
    const { prisma } = M.db;
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { minLeadMinutes: 0, maxAdvanceDays: 30 } });
    const r = await M.pub.bookPublic(`p-${uid}-a`, { serviceId: M.svcA, staffId: M.stfA, startsAt: at(1020), customer: { name: "Kvkk Kişi", phone: "+905332227777" }, kvkkAccepted: true, marketingConsent: false });
    expect(r.id).toBeTruthy();
    const c = await prisma.customer.findFirstOrThrow({ where: { tenantId: M.A.tenantId, phone: "+905332227777" } });
    expect(c.kvkkAcceptedAt).toBeInstanceOf(Date);
    const p = await M.appts.createPanelAppointment(M.ownerA, M.appts.createSchema.parse({ serviceId: M.svcA, staffId: M.stfA, startsAt: at(1050).toISOString(), customer: cust(50, "Panel Kişi") }));
    const pc = await prisma.customer.findUniqueOrThrow({ where: { id: (p.customer as { id: string }).id } });
    expect(pc.kvkkAcceptedAt).toBeNull();
  });
});
