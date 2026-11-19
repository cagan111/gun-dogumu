import { afterAll, beforeAll, describe, expect, it } from "vitest";

try { process.loadEnvFile(".env"); } catch { /* .env yok */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);
const DAY = 86_400_000;

describe.skipIf(!HAS_DB)("süper-admin, defter ve abonelik (gerçek DB)", () => {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const M = {} as {
    db: typeof import("@/lib/db"); signup: typeof import("@/lib/signup"); sess: typeof import("@/lib/session");
    ledger: typeof import("@/lib/ledger"); admin: typeof import("@/lib/admin/service"); pay: typeof import("@/lib/billing/payments");
    sub: typeof import("@/lib/billing/subscription"); pp: typeof import("@/lib/plan-price"); set: typeof import("@/lib/panel/settings");
    A: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>; B: Awaited<ReturnType<typeof import("@/lib/signup").signupSalon>>;
    adminId: string; ids: string[];
  };
  const mk = (slug: string, email: string) => ({ email, password: "supersecret1", name: "Sahip", salonName: slug, city: "Girne" as const, slug });

  beforeAll(async () => {
    M.db = await import("@/lib/db"); M.signup = await import("@/lib/signup"); M.sess = await import("@/lib/session");
    M.ledger = await import("@/lib/ledger"); M.admin = await import("@/lib/admin/service"); M.pay = await import("@/lib/billing/payments");
    M.sub = await import("@/lib/billing/subscription"); M.pp = await import("@/lib/plan-price"); M.set = await import("@/lib/panel/settings");
    M.A = await M.signup.signupSalon(mk(`ad-${uid}-a`, `ada-${uid}@example.test`));
    M.B = await M.signup.signupSalon(mk(`ad-${uid}-b`, `adb-${uid}@example.test`));
    M.ids = [M.A.tenantId, M.B.tenantId];
    const su = await M.db.prisma.user.create({ data: { email: `adsu-${uid}@example.test`, name: "Süper", role: "superadmin" } });
    M.adminId = su.id;
  });

  afterAll(async () => {
    if (!M.db) return;
    const { prisma } = M.db;
    await prisma.auditLog.deleteMany({ where: { OR: [{ tenantId: { in: M.ids } }, { actorId: M.adminId }] } });
    await prisma.user.deleteMany({ where: { email: `adsu-${uid}@example.test` } });
    await prisma.planPrice.deleteMany({ where: { planId: "pro", priceTry: "1337.00" } });
    await prisma.tenant.deleteMany({ where: { id: { in: M.ids } } });
    await prisma.$disconnect();
  });

  const balance = (tenantId: string) => M.ledger.getBalance(M.db.withTenant(tenantId));

  it("yetki: owner/tenant kullanıcısı süper-admin servislerine giremez (403), oturumsuz 401, süper-admin geçer", async () => {
    await expect(M.sess.resolveSuperadmin({ user: { id: M.A.userId, role: "owner", tenantId: M.A.tenantId } })).rejects.toMatchObject({ code: "forbidden" });
    await expect(M.sess.resolveSuperadmin(null)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(M.sess.resolveSuperadmin({ user: { id: M.adminId, role: "superadmin" } })).resolves.toMatchObject({ user: { id: M.adminId } });
    // süper-admin tenant paneline girmez
    await expect(M.sess.resolveTenantUser({ user: { id: M.adminId, role: "superadmin" } })).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("defter: bakiye, kredi, düşüm, iade; eksiye düşmez, allowNegative ile düşer", async () => {
    const t = M.A.tenantId;
    expect(await balance(t)).toBe(100);
    expect((await M.ledger.credit(t, 50, "package_purchase")).balance).toBe(150);
    expect((await M.ledger.debit(t, 30, { reason: "reminder" })).balance).toBe(120);
    expect((await M.ledger.refund(t, 10, { note: "iade" })).balance).toBe(130);
    await expect(M.ledger.debit(t, 131, { reason: "campaign" })).rejects.toMatchObject({ code: "insufficient_credits", balance: 130 });
    expect(await balance(t)).toBe(130);
    expect((await M.ledger.debit(t, 135, { reason: "notification", allowNegative: true })).balance).toBe(-5);
    await expect(M.ledger.debit(t, 0, { reason: "reminder" })).rejects.toMatchObject({ code: "validation" });
    // balanceAfter son satırla tutarlı
    const last = await M.db.prisma.smsLedger.findFirst({ where: { tenantId: t }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    expect(last?.balanceAfter).toBe(-5);
    await M.ledger.credit(t, 105, "adjustment");
    expect(await balance(t)).toBe(100);
  });

  it("eşzamanlı düşümler bakiyeyi eksiye çekemez", async () => {
    const t = M.B.tenantId;
    expect(await balance(t)).toBe(100);
    // iki eşzamanlı 70'lik düşüm: yalnız biri geçer
    const two = await Promise.allSettled([M.ledger.debit(t, 70, { reason: "campaign" }), M.ledger.debit(t, 70, { reason: "campaign" })]);
    expect(two.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = two.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rej.reason).toMatchObject({ code: "insufficient_credits" });
    expect(await balance(t)).toBe(30);
    // 40 eşzamanlı 1'lik düşüm: tam 30'u geçer
    const many = await Promise.allSettled(Array.from({ length: 40 }, () => M.ledger.debit(t, 1, { reason: "reminder" })));
    expect(many.filter((r) => r.status === "fulfilled")).toHaveLength(30);
    expect(await balance(t)).toBe(0);
    const min = await M.db.prisma.smsLedger.aggregate({ where: { tenantId: t }, _min: { balanceAfter: true } });
    expect(min._min.balanceAfter).toBeGreaterThanOrEqual(0);
  });

  it("manuel ödeme: abonelik max(now, bitiş)+ay uzar, active, pastDueSince temizlenir, plan değişir, AuditLog actorId ile", async () => {
    const { prisma } = M.db;
    const now = new Date("2026-12-10T09:00:00Z");
    // 1) süresi geçmiş salon: now'dan uzar
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { status: "past_due", pastDueSince: new Date(now.getTime() - 3 * DAY), subscriptionEndsAt: new Date(now.getTime() - 5 * DAY) } });
    const r1 = await M.pay.recordManualPayment({ id: M.adminId }, M.pay.paymentSchema.parse({ idempotencyKey: crypto.randomUUID(), tenantId: M.A.tenantId, amountTry: 1250, months: 1, plan: "pro", note: "Elden" }), now);
    expect(r1.subscriptionEndsAt.toISOString()).toBe("2027-01-10T09:00:00.000Z");
    let t = await prisma.tenant.findUniqueOrThrow({ where: { id: M.A.tenantId } });
    expect(t.status).toBe("active");
    expect(t.pastDueSince).toBeNull();
    expect(t.plan).toBe("pro");
    // 2) süresi sürüyor: mevcut bitişten uzar (kayıp yok)
    const r2 = await M.pay.recordManualPayment({ id: M.adminId }, M.pay.paymentSchema.parse({ idempotencyKey: crypto.randomUUID(), tenantId: M.A.tenantId, amountTry: 2500, months: 2 }), now);
    expect(r2.subscriptionEndsAt.toISOString()).toBe("2027-03-10T09:00:00.000Z");
    t = await prisma.tenant.findUniqueOrThrow({ where: { id: M.A.tenantId } });
    expect(t.plan).toBe("pro");
    const pays = await prisma.payment.findMany({ where: { tenantId: M.A.tenantId }, orderBy: { createdAt: "asc" } });
    expect(pays.map((p) => [p.method, Number(p.amountTry), p.createdBy])).toEqual([["manual", 1250, M.adminId], ["manual", 2500, M.adminId]]);
    const audit = await prisma.auditLog.findMany({ where: { tenantId: M.A.tenantId, action: "payment.record" } });
    expect(audit).toHaveLength(2);
    expect(audit[0]).toMatchObject({ actorId: M.adminId, actorRole: "superadmin" });
    // 3) geçersiz girdi / var olmayan salon
    expect(M.pay.paymentSchema.safeParse({ tenantId: "x", amountTry: 10, months: 13 }).success).toBe(false);
    expect(M.pay.paymentSchema.safeParse({ tenantId: "x", amountTry: 10, months: 1, plan: "yok" }).success).toBe(false);
    await expect(M.pay.recordManualPayment({ id: M.adminId }, { idempotencyKey: crypto.randomUUID(), tenantId: "yok", amountTry: 10, months: 1 }, now)).rejects.toMatchObject({ code: "not_found" });
    // askıdaki salon ödemeyle açılır
    await prisma.tenant.update({ where: { id: M.A.tenantId }, data: { status: "suspended" } });
    await M.pay.recordManualPayment({ id: M.adminId }, { idempotencyKey: crypto.randomUUID(), tenantId: M.A.tenantId, amountTry: 1, months: 1 }, now);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: M.A.tenantId } })).status).toBe("active");
  });

  it("SMS kredisi + paket talebi: eşleşen talep karşılanır, ledger package_purchase, AuditLog; tekrar/uyumsuz reddedilir", async () => {
    const { prisma } = M.db;
    const ownerA = await M.sess.resolveTenantUser({ user: { id: M.A.userId, role: "owner", tenantId: M.A.tenantId } });
    const before = await balance(M.A.tenantId);
    const req = await M.set.createSmsRequest(ownerA, { size: 500 });
    await expect(M.admin.addSmsCredits({ id: M.adminId }, { tenantId: M.A.tenantId, amount: 1000, requestId: req.id })).rejects.toMatchObject({ code: "validation" });
    await expect(M.admin.addSmsCredits({ id: M.adminId }, { tenantId: M.B.tenantId, amount: 500, requestId: req.id })).rejects.toMatchObject({ code: "not_found" }); // başka salonun talebi
    const r = await M.admin.addSmsCredits({ id: M.adminId }, { tenantId: M.A.tenantId, amount: 500, requestId: req.id, note: "Havale" });
    expect(r.balance).toBe(before + 500);
    expect((await prisma.smsPackageRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe("fulfilled");
    await expect(M.admin.addSmsCredits({ id: M.adminId }, { tenantId: M.A.tenantId, amount: 500, requestId: req.id })).rejects.toMatchObject({ code: "conflict" });
    expect(await balance(M.A.tenantId)).toBe(before + 500);
    const led = await prisma.smsLedger.findFirstOrThrow({ where: { tenantId: M.A.tenantId, reason: "package_purchase", delta: 500 } });
    expect(led.note).toBe("Havale");
    expect(await prisma.auditLog.count({ where: { tenantId: M.A.tenantId, action: "sms.credit", actorId: M.adminId } })).toBe(1);
    // talep reddi
    const r2 = await M.set.createSmsRequest(ownerA, { size: 1000 });
    expect(await M.admin.resolveSmsRequest({ id: M.adminId }, r2.id, { action: "reject" })).toMatchObject({ status: "rejected" });
    await expect(M.admin.resolveSmsRequest({ id: M.adminId }, r2.id, { action: "fulfil" })).rejects.toMatchObject({ code: "conflict" });
    // resolve ile karşılama
    const r3 = await M.set.createSmsRequest(ownerA, { size: 5000 });
    const f = await M.admin.resolveSmsRequest({ id: M.adminId }, r3.id, { action: "fulfil" });
    expect(f).toMatchObject({ balance: before + 5500 });
    const list = await M.admin.listSmsRequests({ page: 1, pageSize: 10, tenantId: M.A.tenantId });
    expect(list.total).toBe(3);
  });

  it("plan değiştir, askıya al / aç; hepsi AuditLog'a yazılır; liste/detay alanları", async () => {
    const { prisma } = M.db;
    const now = new Date();
    await prisma.tenant.update({ where: { id: M.B.tenantId }, data: { status: "trial", trialEndsAt: new Date(now.getTime() + 5 * DAY) } });
    await M.admin.changePlan({ id: M.adminId }, M.B.tenantId, { plan: "salon_plus" });
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: M.B.tenantId } })).plan).toBe("salon_plus");
    await M.admin.suspendTenant({ id: M.adminId }, M.B.tenantId);
    await expect(M.admin.suspendTenant({ id: M.adminId }, M.B.tenantId)).rejects.toMatchObject({ code: "conflict" });
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: M.B.tenantId } })).status).toBe("suspended");
    expect(await M.admin.unsuspendTenant({ id: M.adminId }, M.B.tenantId, now)).toMatchObject({ status: "trial" });
    await expect(M.admin.unsuspendTenant({ id: M.adminId }, M.B.tenantId, now)).rejects.toMatchObject({ code: "conflict" });
    await expect(M.admin.changePlan({ id: M.adminId }, "yok", { plan: "pro" })).rejects.toMatchObject({ code: "not_found" });
    const actions = (await prisma.auditLog.findMany({ where: { tenantId: M.B.tenantId, actorId: M.adminId } })).map((a) => a.action).sort();
    expect(actions).toEqual(["tenant.plan_changed", "tenant.suspended", "tenant.unsuspended"]);
    const list = await M.admin.listTenants({ page: 1, pageSize: 10, q: `ad-${uid}` });
    expect(list.total).toBe(2);
    const a = list.tenants.find((x) => x.id === M.A.tenantId)!;
    expect(a).toMatchObject({ status: "active", plan: "pro", smsBalance: await balance(M.A.tenantId) });
    expect(a.subscriptionEndsAt).toBeInstanceOf(Date);
    expect((await M.admin.listTenants({ page: 1, pageSize: 10, q: `ad-${uid}`, status: "suspended" })).total).toBe(0);
    const detail = await M.admin.getTenantDetail(M.A.tenantId);
    expect(detail.payments.length).toBe(3);
    expect(detail.users[0]?.role).toBe("owner");
    const au = await M.admin.listAudit({ page: 1, pageSize: 5, tenantId: M.B.tenantId });
    expect(au.entries.every((e) => e.tenantId === M.B.tenantId)).toBe(true);
    expect(au.total).toBeGreaterThanOrEqual(3);
  });

  it("plan fiyatı: DB ezmesi config'i geçer, null ezmeyi kaldırır; MRR güncel fiyatı kullanır; gelir özeti", async () => {
    const { prisma } = M.db;
    const before = await M.admin.revenueSummary();
    expect(await M.pp.getPlanPrice("pro")).toBe(1250);
    await M.admin.updatePlanPrices({ id: M.adminId }, { prices: { pro: 1337 } });
    try {
      expect(await M.pp.getPlanPrice("pro")).toBe(1337);
      expect((await M.pp.getAllPlanPrices()).baslangic).toBe(750);
      const after = await M.admin.revenueSummary();
      const proActive = await prisma.tenant.count({ where: { status: "active", plan: "pro" } });
      expect(after.mrrTry - before.mrrTry).toBe(proActive * (1337 - 1250));
      expect(after.counts.active).toBeGreaterThanOrEqual(1);
      expect(after.smsSoldThisMonth).toBeGreaterThanOrEqual(5500);
      expect(after.paymentsThisMonthTry).toBeGreaterThanOrEqual(3751);
    } finally {
      await M.admin.updatePlanPrices({ id: M.adminId }, { prices: { pro: null } });
    }
    expect(await M.pp.getPlanPrice("pro")).toBe(1250);
  });

  it("abonelik tick'i: deneme bitti → past_due + uyarı (tekrarsız), 7 gün sonra suspended, ödeme → active", async () => {
    const { prisma } = M.db;
    const now = new Date("2027-02-01T10:00:00Z");
    await prisma.tenant.update({ where: { id: M.B.tenantId }, data: { status: "trial", trialEndsAt: new Date(now.getTime() + 2 * DAY), subscriptionEndsAt: null, pastDueSince: null } });
    const only = { tenantIds: [M.B.tenantId] };
    const t0 = await M.sub.applySubscriptionTick(now, only);
    expect(t0.transitions).toEqual([]);
    expect(t0.notices.map((n) => n.kind)).toEqual(["trial_ending"]);
    expect((await M.sub.applySubscriptionTick(now, only)).notices).toEqual([]); // aynı uyarı tekrarlanmaz
    const t1 = await M.sub.applySubscriptionTick(new Date(now.getTime() + 3 * DAY), only);
    expect(t1.transitions).toEqual([{ tenantId: M.B.tenantId, from: "trial", to: "past_due" }]);
    expect(t1.notices.map((n) => n.kind)).toEqual(["trial_ended"]);
    const tmid = await M.sub.applySubscriptionTick(new Date(now.getTime() + 6 * DAY), only);
    expect(tmid.transitions).toEqual([]);
    const t2 = await M.sub.applySubscriptionTick(new Date(now.getTime() + 10.5 * DAY), only);
    expect(t2.transitions).toEqual([{ tenantId: M.B.tenantId, from: "past_due", to: "suspended" }]);
    expect(t2.notices.map((n) => n.kind)).toEqual(["suspended"]);
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: M.B.tenantId } })).status).toBe("suspended");
    expect(await prisma.auditLog.count({ where: { tenantId: M.B.tenantId, action: "subscription.status_changed" } })).toBe(2);
    await M.pay.recordManualPayment({ id: M.adminId }, { idempotencyKey: crypto.randomUUID(), tenantId: M.B.tenantId, amountTry: 2000, months: 1 }, new Date(now.getTime() + 11 * DAY));
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: M.B.tenantId } })).status).toBe("active");
  });
});
