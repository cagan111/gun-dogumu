import { afterAll, beforeAll, describe, expect, it } from "vitest";

try { process.loadEnvFile(".env"); } catch { /* .env yok */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("kayıt, izolasyon, public API, OTP (gerçek DB)", () => {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const slugA = `t-${uid}-a`;
  const slugB = `t-${uid}-b`;
  const emailA = `a-${uid}@example.test`;
  const emailB = `b-${uid}@example.test`;
  const su = `su-${uid}@example.test`;
  const S = {} as {
    signup: typeof import("@/lib/signup"); db: typeof import("@/lib/db"); sess: typeof import("@/lib/session");
    pub: typeof import("@/lib/public"); otp: typeof import("@/lib/otp"); http: typeof import("@/lib/http");
    booking: typeof import("@/lib/booking"); time: typeof import("@/lib/time"); login: typeof import("@/lib/login");
    cancel: typeof import("@/lib/cancel"); lt: typeof import("@/lib/login-token"); boot: typeof import("@/lib/bootstrap");
    a: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>; b: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>;
    apptB: string; date: string; svc: string; staff: string;
  };
  const input = (slug: string, email: string) => ({ email, password: "supersecret1", name: "Sahip", salonName: slug, city: "Girne" as const, slug });

  beforeAll(async () => {
    S.signup = await import("@/lib/signup"); S.db = await import("@/lib/db"); S.sess = await import("@/lib/session");
    S.pub = await import("@/lib/public"); S.otp = await import("@/lib/otp"); S.http = await import("@/lib/http");
    S.booking = await import("@/lib/booking"); S.time = await import("@/lib/time"); S.login = await import("@/lib/login");
    S.cancel = await import("@/lib/cancel"); S.lt = await import("@/lib/login-token"); S.boot = await import("@/lib/bootstrap");
    S.a = await S.signup.signupSalon(input(slugA, emailA));
    S.b = await S.signup.signupSalon(input(slugB, emailB));
    S.date = S.time.addDays(S.time.utcToLocal(new Date(), "Asia/Famagusta").date, 3);
    // A salonuna hizmet/personel/çalışma saati
    const { prisma } = S.db;
    const tenantId = S.a.tenantId;
    const st = await prisma.staff.create({ data: { tenantId, name: "Ali" } });
    const sv = await prisma.service.create({ data: { tenantId, nameTr: "Saç", durationMin: 30, bufferMin: 0, priceTry: "400" } });
    await prisma.serviceStaff.create({ data: { tenantId, serviceId: sv.id, staffId: st.id } });
    await prisma.workingHours.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ tenantId, staffId: st.id, weekday, startMin: 540, endMin: 1080, breaks: [] })) });
    await prisma.tenant.update({ where: { id: tenantId }, data: { minLeadMinutes: 0 } });
    S.svc = sv.id; S.staff = st.id;
    // B salonunda bir randevu (izolasyon testi için)
    const bs = await prisma.staff.create({ data: { tenantId: S.b.tenantId, name: "Bora" } });
    const bsv = await prisma.service.create({ data: { tenantId: S.b.tenantId, nameTr: "Sakal", durationMin: 30, priceTry: "200" } });
    const bc = await prisma.customer.create({ data: { tenantId: S.b.tenantId, name: "Müşteri", phone: "+905331110000" } });
    const start = S.time.zonedToUtc(S.date, 600, "Asia/Famagusta");
    const ap = await prisma.appointment.create({
      data: { tenantId: S.b.tenantId, staffId: bs.id, serviceId: bsv.id, customerId: bc.id, startsAt: start, endsAt: new Date(start.getTime() + 1_800_000), blockedUntil: new Date(start.getTime() + 1_800_000), cancelToken: `tok-${uid}-bbbbbbbbbbbbbbbb`, priceTry: "200" },
    });
    S.apptB = ap.id;
  });

  afterAll(async () => {
    if (!S.db) return;
    const { prisma } = S.db;
    const ids = [S.a?.tenantId, S.b?.tenantId].filter(Boolean) as string[];
    await prisma.user.deleteMany({ where: { email: su } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } }); // kullanıcılar, defter, otp cascade
    await prisma.$disconnect();
  });

  it("kayıt: deneme tenant + owner + plan SMS kredisi", async () => {
    const { prisma } = S.db;
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: S.a.tenantId }, include: { users: true, smsLedger: true } });
    expect(t.status).toBe("trial");
    expect(t.plan).toBe("baslangic");
    expect(t.timeZone).toBe("Asia/Famagusta");
    const days = (t.trialEndsAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    expect(t.users).toHaveLength(1);
    expect(t.users[0]).toMatchObject({ email: emailA, role: "owner", tenantId: t.id });
    expect(t.users[0]!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(t.smsLedger).toHaveLength(1);
    expect(t.smsLedger[0]).toMatchObject({ delta: 100, reason: "plan_monthly", balanceAfter: 100 });
  });

  it("aynı slug veya e-posta → 409 (conflict)", async () => {
    const e1 = await S.signup.signupSalon(input(slugA, `x-${uid}@example.test`)).catch((e: unknown) => e);
    expect(S.http.errorResponse(e1).status).toBe(409);
    expect(e1).toMatchObject({ code: "conflict", field: "slug" });
    const e2 = await S.signup.signupSalon(input(`${slugA}-2`, emailA)).catch((e: unknown) => e);
    expect(S.http.errorResponse(e2).status).toBe(409);
    expect(e2).toMatchObject({ field: "email" });
    // yarım kalan tenant bırakılmamalı (transaction)
    expect(await S.db.prisma.tenant.findUnique({ where: { slug: `${slugA}-2` } })).toBeNull();
  });

  it("slug-check: boşta / alınmış / rezerve / biçim", async () => {
    expect(await S.signup.checkSlug(slugA)).toMatchObject({ available: false, reason: "taken" });
    expect(await S.signup.checkSlug(`t-${uid}-free`)).toEqual({ valid: true, available: true });
    expect(await S.signup.checkSlug("admin")).toMatchObject({ valid: false, reason: "reserved" });
    expect(await S.signup.checkSlug("AB")).toMatchObject({ valid: false, reason: "format" });
  });

  it("giriş: doğru şifre, yanlış şifre, bilinmeyen e-posta", async () => {
    expect(await S.login.authenticatePassword(emailA, "supersecret1", "9.9.9.9")).toMatchObject({ role: "owner", tenantId: S.a.tenantId });
    expect(await S.login.authenticatePassword(emailA, "yanlis-sifre", "9.9.9.8")).toBeNull();
    expect(await S.login.authenticatePassword("yok@example.test", "supersecret1", "9.9.9.7")).toBeNull();
  });

  it("TENANT İZOLASYONU: A'nın oturum yardımcısı B'nin randevusunu okuyamaz/güncelleyemez", async () => {
    const ctx = await S.sess.resolveTenantUser({ user: { id: S.a.userId, role: "owner", tenantId: S.a.tenantId } });
    expect(ctx.tenantId).toBe(S.a.tenantId);
    // okuma
    expect(await ctx.db.appointment.findUnique({ where: { id: S.apptB } })).toBeNull();
    expect(await ctx.db.appointment.findFirst({ where: { id: S.apptB } })).toBeNull();
    expect(await ctx.db.appointment.findMany({})).toHaveLength(0);
    // güncelleme / silme: kapsam dışı → hiçbir satır etkilenmez
    expect((await ctx.db.appointment.updateMany({ where: { id: S.apptB }, data: { status: "cancelled_by_salon" } })).count).toBe(0);
    await expect(ctx.db.appointment.update({ where: { id: S.apptB }, data: { status: "cancelled_by_salon" } })).rejects.toThrow();
    expect((await ctx.db.appointment.deleteMany({ where: { id: S.apptB } })).count).toBe(0);
    // B'nin diğer tablolarına da erişim yok
    expect(await ctx.db.customer.findMany({})).toHaveLength(0);
    // tenantId filtresi ezilemez: B'yi istesek de yalnız A'nın satırları döner
    const staffSeen = await ctx.db.staff.findMany({ where: { tenantId: S.b.tenantId } });
    expect(staffSeen.every((x) => x.tenantId === S.a.tenantId)).toBe(true);
    const still = await S.db.prisma.appointment.findUniqueOrThrow({ where: { id: S.apptB } });
    expect(still.status).toBe("confirmed");
    // B'nin sahibi kendi randevusunu görür
    const ctxB = await S.sess.resolveTenantUser({ user: { id: S.b.userId, role: "owner", tenantId: S.b.tenantId } });
    expect(await ctxB.db.appointment.findUnique({ where: { id: S.apptB } })).not.toBeNull();
  });

  it("oturum yardımcısı: oturumsuz 401, bayat tenantId 401, superadmin panelde 401, owner süper-admine 403", async () => {
    await expect(S.sess.resolveTenantUser(null)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(S.sess.resolveTenantUser({ user: { id: S.a.userId, role: "owner", tenantId: S.b.tenantId } })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(S.sess.resolveTenantUser({ user: { id: "yok", role: "owner", tenantId: S.a.tenantId } })).rejects.toMatchObject({ code: "unauthorized" });
    await expect(S.sess.resolveSuperadmin({ user: { id: S.a.userId, role: "superadmin" } })).rejects.toMatchObject({ code: "forbidden" });
    await expect(S.sess.resolveSuperadmin(null)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("ensureSuperadmin: bir kez oluşturur, idempotent; set_password token'ı tek kullanımlık", async () => {
    const env = { SUPERADMIN_EMAIL: su.toUpperCase() };
    expect(await S.boot.ensureSuperadmin({})).toBe("skipped");
    expect(await S.boot.ensureSuperadmin(env)).toBe("created");
    expect(await S.boot.ensureSuperadmin(env)).toBe("exists"); // geçerli bağlantı var
    const u = await S.db.prisma.user.findUniqueOrThrow({ where: { email: su } });
    expect(u).toMatchObject({ role: "superadmin", tenantId: null, passwordHash: null });
    const tok = await S.lt.createLoginToken(u.id, "set_password");
    expect(await S.lt.consumeLoginToken(tok, "magic_link")).toBeNull(); // yanlış amaç
    expect(await S.lt.consumeLoginToken(tok, "set_password")).toBe(u.id);
    expect(await S.lt.consumeLoginToken(tok, "set_password")).toBeNull(); // ikinci kullanım
    const row = await S.db.prisma.loginToken.findFirstOrThrow({ where: { userId: u.id, usedAt: { not: null } } });
    expect(row.tokenHash).not.toBe(tok); // ham token saklanmaz
    const expired = await S.lt.createLoginToken(u.id, "magic_link", new Date(Date.now() - 3_600_000));
    expect(await S.lt.consumeLoginToken(expired, "magic_link")).toBeNull();
  });

  it("public API: salon bilgisi, hizmetler, personel, slotlar", async () => {
    const info = await S.pub.getSalonInfo(slugA);
    expect(info).toMatchObject({ suspended: false, name: slugA, city: "Girne" });
    const svcs = await S.pub.listPublicServices(slugA);
    expect(svcs).toEqual([expect.objectContaining({ id: S.svc, priceTry: 400, staffIds: [S.staff] })]);
    expect(await S.pub.listPublicStaff(slugA)).toEqual([{ id: S.staff, name: "Ali", photoUrl: null }]);
    const slots = await S.pub.getSlots(slugA, { serviceId: S.svc, staffId: "any", date: S.date });
    expect(slots.slots[0]).toMatchObject({ time: "09:00", staffIds: [S.staff] });
    expect(slots.slots.some((s) => s.time === "10:00")).toBe(true);
    await expect(S.pub.getSlots(slugA, { serviceId: "yok", staffId: "any", date: S.date })).rejects.toMatchObject({ code: "not_found" });
    await expect(S.pub.getSalonInfo("yok-yok-yok")).rejects.toMatchObject({ code: "not_found" });
  });

  it("public randevu: oluşur, çift rezervasyon 409, token ile özet ve iptal", async () => {
    const parsed = S.pub.publicBookingSchema.safeParse({
      serviceId: S.svc, staffId: S.staff, startsAt: S.time.zonedToUtc(S.date, 600, "Asia/Famagusta").toISOString(),
      customer: { name: "Ayşe Yılmaz", phone: "0533 222 33 44" }, kvkkAccepted: true,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.marketingConsent).toBe(false);
    expect(parsed.data.customer.phone).toBe("+905332223344");
    const r = await S.pub.bookPublic(slugA, parsed.data);
    expect(r.cancelUrl).toMatch(/^\/r\/[A-Za-z0-9_-]{32}$/);
    // aynı slot → 409
    const dup = await S.pub.bookPublic(slugA, parsed.data).catch((e: unknown) => e);
    expect(S.http.errorResponse(dup).status).toBe(409);
    // slot artık listede yok
    const slots = await S.pub.getSlots(slugA, { serviceId: S.svc, staffId: S.staff, date: S.date });
    expect(slots.slots.some((s) => s.time === "10:00")).toBe(false);
    // kvkk onaysız reddedilir
    expect(S.pub.publicBookingSchema.safeParse({ ...parsed.data, startsAt: parsed.data.startsAt.toISOString(), kvkkAccepted: false }).success).toBe(false);
    // token ile özet
    const token = r.cancelUrl.slice(3);
    const sum = await S.cancel.getAppointmentByToken(token);
    expect(sum).toMatchObject({ status: "confirmed", cancellable: true, staffName: "Ali", salon: { slug: slugA } });
    expect(await S.cancel.cancelAppointment(token)).toMatchObject({ status: "cancelled_by_customer" });
    expect((await S.cancel.getAppointmentByToken(token)).cancellable).toBe(false);
    const again = await S.cancel.cancelAppointment(token).catch((e: unknown) => e);
    expect(S.http.errorResponse(again).status).toBe(409);
    await expect(S.cancel.getAppointmentByToken("x".repeat(30))).rejects.toMatchObject({ code: "not_found" });
  });

  it("askıdaki salon: bilgi suspended bayraklı, rezervasyon 423", async () => {
    await S.db.prisma.tenant.update({ where: { id: S.b.tenantId }, data: { status: "suspended" } });
    expect(await S.pub.getSalonInfo(slugB)).toMatchObject({ suspended: true });
    const e = await S.pub.listPublicServices(slugB).catch((x: unknown) => x);
    expect(S.http.errorResponse(e).status).toBe(423);
    await S.db.prisma.tenant.update({ where: { id: S.b.tenantId }, data: { status: "trial" } });
  });

  it("OTP: istek → doğrulama, yanlış kodda 5 deneme kilidi, kullanılmış kod reddi", async () => {
    const phone = "+905332223344"; // yukarıdaki müşteri
    let sent = "";
    const send = async (_t: string, _p: string, code: string) => { sent = code; };
    await S.otp.requestOtp(S.a.tenantId, "0533 222 33 44", { send });
    expect(sent).toMatch(/^\d{6}$/);
    const row = await S.db.prisma.otp.findFirstOrThrow({ where: { tenantId: S.a.tenantId, phone }, orderBy: { createdAt: "desc" } });
    expect(row.codeHash).not.toContain(sent);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(299_000);
    const wrong = sent === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) await expect(S.otp.verifyOtp(S.a.tenantId, phone, wrong)).rejects.toMatchObject({ code: "otp_invalid" });
    // doğru kod bile artık kilitli
    await expect(S.otp.verifyOtp(S.a.tenantId, phone, sent)).rejects.toMatchObject({ code: "otp_locked" });
    // yeni kod → eskisi geçersiz, yenisi çalışır
    const resendAt = new Date(Date.now() + 61_000);
    await S.otp.requestOtp(S.a.tenantId, phone, { send, now: resendAt });
    expect(await S.otp.verifyOtp(S.a.tenantId, phone, sent)).toEqual({ phone });
    await expect(S.otp.verifyOtp(S.a.tenantId, phone, sent)).rejects.toMatchObject({ code: "otp_invalid" }); // tek kullanım
    // Randevularım
    await S.pub.bookPublic(slugA, { serviceId: S.svc, staffId: S.staff, startsAt: S.time.zonedToUtc(S.date, 660, "Asia/Famagusta"), customer: { name: "Ayşe", phone }, kvkkAccepted: true, marketingConsent: false });
    const mine = await S.otp.upcomingForCustomer(S.a.tenantId, phone, new Date(0));
    expect(mine).toHaveLength(1); // iptal edilen sayılmaz
    expect(mine[0]).toMatchObject({ cancelUrl: `/r/${mine[0]!.cancelToken}`, staffName: "Ali" });
    expect(await S.otp.upcomingForCustomer(S.b.tenantId, phone, new Date(0))).toHaveLength(0);
    // süresi dolmuş kod
    await S.otp.requestOtp(S.a.tenantId, phone, { send, now: new Date(+resendAt + 61_000) });
    await S.db.prisma.otp.updateMany({ where: { tenantId: S.a.tenantId, phone, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1) } });
    await expect(S.otp.verifyOtp(S.a.tenantId, phone, sent)).rejects.toMatchObject({ code: "otp_expired" });
  });

  it("OTP: bilinmeyen telefona kod üretilmez ama yanıt aynı; B'nin müşterisine A'dan OTP yok", async () => {
    let called = false;
    const send = async () => { called = true; };
    await expect(S.otp.requestOtp(S.a.tenantId, "0533 111 00 00", { send })).resolves.toEqual({ sent: true }); // B'nin müşterisi
    expect(called).toBe(false);
    await expect(S.otp.requestOtp(S.a.tenantId, "abc", { send })).rejects.toMatchObject({ code: "invalid_phone" });
  });

  it("OTP isteği telefon başına saatte 5", async () => {
    const send = async () => {};
    const ph = "0533 555 66 77";
    for (let i = 0; i < 5; i++) await S.otp.requestOtp(S.a.tenantId, ph, { send });
    await expect(S.otp.requestOtp(S.a.tenantId, ph, { send })).rejects.toMatchObject({ code: "rate_limited" });
  });
});
