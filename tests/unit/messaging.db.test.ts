import { afterAll, beforeAll, describe, expect, it } from "vitest";

try { process.loadEnvFile(".env"); } catch { /* .env yok */ }
const HAS_DB = Boolean(process.env.DATABASE_URL);
const TZ = "Asia/Famagusta";
const WA_ENV = { WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1" }; // kapı kapalı → Mock WhatsApp, ağ yok

describe.skipIf(!HAS_DB)("mesajlaşma, işler, kampanya, kredi (gerçek DB)", () => {
  const uid = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const M = {} as {
    db: typeof import("@/lib/db"); signup: typeof import("@/lib/signup"); sess: typeof import("@/lib/session");
    ledger: typeof import("@/lib/ledger"); h: typeof import("@/jobs/handlers"); sched: typeof import("@/lib/messaging/schedule");
    q: typeof import("@/jobs/queue"); camp: typeof import("@/lib/messaging/campaign"); credits: typeof import("@/lib/messaging/credits");
    send: typeof import("@/lib/messaging/send"); seg: typeof import("@/lib/messaging/segments"); time: typeof import("@/lib/time");
    cat: typeof import("@/lib/panel/catalog"); otp: typeof import("@/lib/otp"); pay: typeof import("@/lib/billing/payments");
    tenantIds: string[];
  };
  let n = 0;
  type Salon = { tenantId: string; userId: string; staffId: string; serviceId: string };
  const salons: Salon[] = [];

  async function mkSalon(plan: "baslangic" | "pro" | "salon_plus" = "baslangic"): Promise<Salon> {
    const { prisma } = M.db;
    const slug = `m-${uid}-${++n}`;
    const s = await M.signup.signupSalon({ email: `m${n}-${uid}@example.test`, password: "supersecret1", name: "Sahip", salonName: `Salon ${n}`, city: "Girne", slug });
    await prisma.tenant.update({ where: { id: s.tenantId }, data: { plan, phone: "+905331110000" } });
    const staff = await prisma.staff.create({ data: { tenantId: s.tenantId, name: "Ali" } });
    const svc = await prisma.service.create({ data: { tenantId: s.tenantId, nameTr: "Saç Kesimi", durationMin: 30, priceTry: "300" } });
    const out = { tenantId: s.tenantId, userId: s.userId, staffId: staff.id, serviceId: svc.id };
    salons.push(out);
    return out;
  }
  let apptN = 0;
  async function mkAppt(s: Salon, opts: { startsAt?: Date; email?: string | null; consent?: boolean; phone?: string; status?: "confirmed" | "cancelled_by_salon" } = {}) {
    const { prisma } = M.db;
    const i = ++apptN;
    const startsAt = opts.startsAt ?? new Date(Math.floor(Date.now() / 60_000) * 60_000 + 3 * 86_400_000 + i * 45 * 60_000);
    const phone = opts.phone ?? `+9053311${String(10_000 + i).slice(-5)}`;
    const c = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: s.tenantId, phone } },
      create: { tenantId: s.tenantId, name: "Müşteri", phone, email: opts.email ?? null, marketingConsent: opts.consent ?? false },
      update: {},
    });
    const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
    return prisma.appointment.create({
      data: { tenantId: s.tenantId, staffId: s.staffId, serviceId: s.serviceId, customerId: c.id, startsAt, endsAt, blockedUntil: endsAt, cancelToken: `tok-${uid}-${i}-${"x".repeat(24)}`, priceTry: "300", status: opts.status ?? "confirmed" },
    });
  }
  const balance = (s: Salon) => M.ledger.getBalance(M.db.withTenant(s.tenantId));
  const logs = (s: Salon, where: Record<string, unknown> = {}) => M.db.prisma.messageLog.findMany({ where: { tenantId: s.tenantId, ...where }, orderBy: { createdAt: "asc" } });
  const drain = async (s: Salon) => { const b = await balance(s); if (b > 0) await M.ledger.debit(s.tenantId, b, { reason: "notification", note: "test" }); };

  beforeAll(async () => {
    M.db = await import("@/lib/db"); M.signup = await import("@/lib/signup"); M.sess = await import("@/lib/session");
    M.ledger = await import("@/lib/ledger"); M.h = await import("@/jobs/handlers"); M.sched = await import("@/lib/messaging/schedule");
    M.q = await import("@/jobs/queue"); M.camp = await import("@/lib/messaging/campaign"); M.credits = await import("@/lib/messaging/credits");
    M.send = await import("@/lib/messaging/send"); M.seg = await import("@/lib/messaging/segments"); M.time = await import("@/lib/time");
    M.cat = await import("@/lib/panel/catalog"); M.otp = await import("@/lib/otp"); M.pay = await import("@/lib/billing/payments");
  });

  afterAll(async () => {
    if (!M.db) return;
    const { prisma } = M.db;
    const ids = salons.map((s) => s.tenantId);
    await prisma.messageLog.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.appointment.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.customer.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("onay mesajı segment sayısı kadar kredi düşer ve tek MessageLog yazar", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const before = await balance(s);
    const r = await M.h.handleSendConfirmation({ appointmentId: a.id });
    expect(r.status).toBe("sent");
    const rows = await logs(s);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row).toMatchObject({ channel: "sms", template: "confirmation", status: "sent", provider: "mock", appointmentId: a.id, idempotencyKey: `conf:${a.id}` });
    const segs = M.seg.smsSegments(row.content).segments;
    expect(row.cost).toBe(segs);
    expect(await balance(s)).toBe(before - segs);
    const led = await M.db.prisma.smsLedger.findMany({ where: { tenantId: s.tenantId, messageId: row.id } });
    expect(led).toHaveLength(1);
    expect(led[0]).toMatchObject({ delta: -segs, reason: "confirmation" });
    // tekrar çalışırsa yinelenmez
    expect((await M.h.handleSendConfirmation({ appointmentId: a.id })).status).toBe("duplicate");
    expect(await logs(s)).toHaveLength(1);
    expect(await balance(s)).toBe(before - segs);
  });

  it("segment: 2 segmentlik mesaj 2 kredi düşer", async () => {
    const s = await mkSalon();
    const before = await balance(s);
    const o = await M.send.sendMessage({ tenantId: s.tenantId, to: "+905331119999", text: "a".repeat(200), template: "campaign", reason: "campaign" });
    expect(o).toMatchObject({ status: "sent", segments: 2 });
    expect(await balance(s)).toBe(before - 2);
  });

  it("aynı hatırlatma iki kez (art arda ve eşzamanlı) çalışsa bir kez gider", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const before = await balance(s);
    const data = { appointmentId: a.id, offsetMin: 120, startsAt: a.startsAt.toISOString() };
    const res = await Promise.all([M.h.handleSendReminder(data), M.h.handleSendReminder(data), M.h.handleSendReminder(data)]);
    expect(res.filter((r) => r.status === "sent")).toHaveLength(1);
    expect(res.filter((r) => r.status === "duplicate")).toHaveLength(2);
    expect((await M.h.handleSendReminder(data)).status).toBe("duplicate");
    const rows = await logs(s, { template: "reminder_2h" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.idempotencyKey).toBe(`rem:${a.id}:120:${a.startsAt.toISOString()}`);
    expect(await balance(s)).toBe(before - rows[0]!.cost);
    const led = await M.db.prisma.smsLedger.findMany({ where: { tenantId: s.tenantId, reason: "reminder" } });
    expect(led).toHaveLength(1);
  });

  it("aynı salona farklı anahtarlarla eşzamanlı gönderimler kilitlenmez (40P01 regresyonu)", async () => {
    const s = await mkSalon();
    for (let round = 0; round < 5; round++) {
      const before = await balance(s);
      const res = await Promise.all(Array.from({ length: 8 }, (_, i) =>
        M.send.sendMessage({ tenantId: s.tenantId, to: "+905331119999", text: "merhaba", template: "campaign", reason: "campaign", idempotencyKey: `dl-${uid}-${round}-${i}` })));
      expect(res.every((r) => r.status === "sent")).toBe(true);
      expect(await balance(s)).toBe(before - 8);
    }
  });

  it("taşınan randevuda eski hatırlatma atlanır, yenisi planlanır", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const q = new M.q.MemoryQueue();
    const now = new Date();
    await M.sched.onAppointmentChanged(a.id, "created", { now, queue: q });
    const oldRem = q.jobs.filter((j) => j.name === "send-reminder");
    expect(oldRem).toHaveLength(2);
    expect(q.jobs.some((j) => j.name === "send-confirmation")).toBe(true);

    const newStart = new Date(a.startsAt.getTime() + 86_400_000);
    await M.db.prisma.appointment.update({ where: { id: a.id }, data: { startsAt: newStart, endsAt: new Date(newStart.getTime() + 1_800_000), blockedUntil: new Date(newStart.getTime() + 1_800_000) } });
    await M.sched.onAppointmentChanged(a.id, "moved", { now, queue: q });
    const all = q.jobs.filter((j) => j.name === "send-reminder");
    expect(all).toHaveLength(4); // eski 2 + yeni 2 (anahtarlar farklı)
    const fresh = all.filter((j) => (j.data.startsAt as string) === newStart.toISOString());
    expect(fresh.map((j) => j.singletonKey)).toEqual(expect.arrayContaining([`rem:${a.id}:1440:${newStart.toISOString()}`, `rem:${a.id}:120:${newStart.toISOString()}`]));
    expect(q.jobs.some((j) => j.name === "send-notice" && j.data.template === "changed_by_salon")).toBe(true);

    for (const j of oldRem) {
      const r = await M.h.handleSendReminder(j.data as never);
      expect(r).toMatchObject({ status: "skipped", reason: "moved" });
    }
    expect(await logs(s, { template: { in: ["reminder_24h", "reminder_2h"] } })).toHaveLength(0);
    for (const j of fresh) expect((await M.h.handleSendReminder(j.data as never)).status).toBe("sent");
    expect(await logs(s, { template: { in: ["reminder_24h", "reminder_2h"] } })).toHaveLength(2);
  });

  it("iptal edilen randevuda hatırlatma atlanır; yeni plan çıkmaz; kaldırılan ofset atlanır", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const q = new M.q.MemoryQueue();
    await M.sched.onAppointmentChanged(a.id, "created", { queue: q });
    await M.db.prisma.appointment.update({ where: { id: a.id }, data: { status: "cancelled_by_customer" } });
    const before = q.jobs.length;
    await M.sched.onAppointmentChanged(a.id, "cancelled_by_customer", { queue: q });
    expect(q.jobs).toHaveLength(before);
    for (const j of q.jobs.filter((x) => x.name === "send-reminder")) expect(await M.h.handleSendReminder(j.data as never)).toMatchObject({ status: "skipped", reason: "not_active" });
    expect(await logs(s)).toHaveLength(0);

    const b = await mkAppt(s);
    await M.db.prisma.tenant.update({ where: { id: s.tenantId }, data: { reminderOffsets: [60] } });
    expect(await M.h.handleSendReminder({ appointmentId: b.id, offsetMin: 120, startsAt: b.startsAt.toISOString() })).toMatchObject({ status: "skipped", reason: "offset_removed" });
  });

  it("geçmiş ofset planlanmaz; salon iptali bildirimi iş olarak eklenir", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s, { startsAt: new Date(Date.now() + 90 * 60_000) }); // 90 dk sonra: ne 24s ne 2s
    const q = new M.q.MemoryQueue();
    await M.sched.onAppointmentChanged(a.id, "created", { queue: q });
    expect(q.jobs.filter((j) => j.name === "send-reminder")).toHaveLength(0);
    await M.db.prisma.appointment.update({ where: { id: a.id }, data: { status: "cancelled_by_salon" } });
    await M.sched.onAppointmentChanged(a.id, "cancelled_by_salon", { queue: q });
    const notice = q.jobs.find((j) => j.name === "send-notice")!;
    expect(notice.data.template).toBe("cancellation");
    expect((await M.h.handleSendNotice(notice.data as never)).status).toBe("sent");
    expect((await logs(s, { template: "cancellation" }))).toHaveLength(1);
  });

  it("sağlayıcı hatasında kredi iade edilir, kayıt failed olur", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const before = await balance(s);
    const env = { ALLOW_REAL_SMS: "true", SMS_PROVIDER: "netgsm", NETGSM_USERCODE: "u", NETGSM_PASSWORD: "p", NETGSM_HEADER: "H" };
    const calls: string[] = [];
    const fetch = async (url: string) => { calls.push(url); return { ok: true, status: 200, text: async () => "30" }; };
    const r = await M.h.handleSendConfirmation({ appointmentId: a.id }, { providers: { env, fetch } });
    expect(r.status).toBe("failed");
    expect(calls).toEqual(["https://api.netgsm.com.tr/sms/send/xml"]);
    expect(await balance(s)).toBe(before);
    const [row] = await logs(s);
    expect(row).toMatchObject({ status: "failed", provider: "netgsm", cost: 0 });
    const led = await M.db.prisma.smsLedger.findMany({ where: { tenantId: s.tenantId, messageId: row!.id }, orderBy: { createdAt: "asc" } });
    expect(led.map((l) => l.reason)).toEqual(["confirmation", "refund"]);
  });

  it("kredi yetersiz: e-postaya düşer, low_credit günde bir kez", async () => {
    const s = await mkSalon("pro"); // whatsapp özelliği yok
    await drain(s);
    const a = await mkAppt(s, { email: "musteri@example.test" });
    const b = await mkAppt(s, { email: "musteri2@example.test" });
    const r1 = await M.h.handleSendConfirmation({ appointmentId: a.id });
    const r2 = await M.h.handleSendConfirmation({ appointmentId: b.id });
    expect(r1).toMatchObject({ status: "sent", outcome: { channel: "email" } });
    expect(r2).toMatchObject({ status: "sent", outcome: { channel: "email" } });
    expect(await balance(s)).toBe(0);
    const em = await logs(s, { channel: "email", template: "confirmation" });
    expect(em).toHaveLength(2);
    const low = await logs(s, { template: "low_credit" });
    expect(low).toHaveLength(1); // iki gönderim, tek uyarı
    expect(low[0]).toMatchObject({ channel: "email", recipient: `m${n}-${uid}@example.test`, status: "sent" });
    // aynı gün tekrar: yine tek
    await M.send.notifyLowCredit(s.tenantId, new Date());
    expect(await logs(s, { template: "low_credit" })).toHaveLength(1);
    // ertesi gün yeni uyarı
    await M.send.notifyLowCredit(s.tenantId, new Date(Date.now() + 86_400_000));
    expect(await logs(s, { template: "low_credit" })).toHaveLength(2);
  });

  it("kredi yetersiz: Salon+ ve WhatsApp yapılandırılmışsa WhatsApp; kredi düşmez", async () => {
    const s = await mkSalon("salon_plus");
    await drain(s);
    const a = await mkAppt(s, { email: "m@example.test" });
    const r = await M.h.handleSendConfirmation({ appointmentId: a.id }, { providers: { env: { ...WA_ENV } } });
    expect(r).toMatchObject({ status: "sent", outcome: { channel: "whatsapp" } });
    expect(await logs(s, { channel: "whatsapp" })).toHaveLength(1);
    expect(await balance(s)).toBe(0);
    // WhatsApp yapılandırılmamış → e-posta
    const b = await mkAppt(s, { email: "m@example.test" });
    expect(await M.h.handleSendConfirmation({ appointmentId: b.id }, { providers: { env: {} } })).toMatchObject({ outcome: { channel: "email" } });
  });

  it("kredi yetersiz, e-posta da yok → atlandı kaydı; Pro'da WhatsApp denenmez", async () => {
    const s = await mkSalon("pro");
    await drain(s);
    const a = await mkAppt(s, { email: null });
    const r = await M.h.handleSendConfirmation({ appointmentId: a.id }, { providers: { env: { ...WA_ENV } } });
    expect(r).toMatchObject({ status: "skipped", outcome: { reason: "insufficient_credits" } });
    const rows = await logs(s, { template: "confirmation" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "skipped", cost: 0, channel: "sms" });
    expect(await logs(s, { channel: "whatsapp" })).toHaveLength(0);
  });

  it("kampanya: yalnız izinli müşterilere, çıkış ifadesiyle; Başlangıç/Pro plan_feature", async () => {
    const s = await mkSalon("salon_plus");
    await mkAppt(s, { consent: true, phone: "+905331120001" });
    await mkAppt(s, { consent: true, phone: "+905331120002" });
    await mkAppt(s, { consent: false, phone: "+905331120003" });
    const noon = M.time.zonedToUtc(M.time.utcToLocal(new Date(), TZ).date, 12 * 60, TZ);
    const before = await balance(s);
    const r = await M.camp.sendCampaign(s.tenantId, "Bu hafta %20 indirim!", noon);
    expect(r).toMatchObject({ recipients: 2, sent: 2, failed: 0, skipped: 0 });
    const rows = await logs(s, { template: "campaign" });
    expect(rows.map((x) => x.recipient).sort()).toEqual(["+905331120001", "+905331120002"]);
    for (const row of rows) expect(row.content).toMatch(/^Bu hafta %20 indirim!\nİptal için: \+905331110000$/);
    expect(await balance(s)).toBe(before - r.segmentsPerMessage * 2);
    const led = await M.db.prisma.smsLedger.findMany({ where: { tenantId: s.tenantId, reason: "campaign" } });
    expect(led).toHaveLength(2);

    const p = await mkSalon("pro");
    await expect(M.camp.sendCampaign(p.tenantId, "merhaba dünya", noon)).rejects.toMatchObject({ code: "plan_feature" });
  });

  it("kampanya sessiz saatlerde reddedilir (22–08), mesaj gitmez; kredi yetmezse upfront reddedilir", async () => {
    const s = await mkSalon("salon_plus");
    await mkAppt(s, { consent: true, phone: "+905331130001" });
    await mkAppt(s, { consent: true, phone: "+905331130002" });
    const date = M.time.utcToLocal(new Date(), TZ).date;
    for (const min of [22 * 60, 23 * 60 + 30, 3 * 60, 7 * 60 + 59]) {
      await expect(M.camp.sendCampaign(s.tenantId, "merhaba dünya", M.time.zonedToUtc(date, min, TZ))).rejects.toMatchObject({ code: "quiet_hours" });
    }
    expect(await logs(s, { template: "campaign" })).toHaveLength(0);
    const ok = M.time.zonedToUtc(date, 8 * 60, TZ);
    // kredi 1'e düşür: 2 alıcı × ≥1 segment > 1 → hiçbiri gönderilmez
    await drain(s);
    await M.ledger.credit(s.tenantId, 1, "adjustment", "test");
    await expect(M.camp.sendCampaign(s.tenantId, "merhaba dünya", ok)).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(await logs(s, { template: "campaign" })).toHaveLength(0);
    expect(await balance(s)).toBe(1);
  });

  it("hatırlatma sessiz saatten etkilenmez", async () => {
    const s = await mkSalon();
    const a = await mkAppt(s);
    const date = M.time.utcToLocal(new Date(), TZ).date;
    const night = M.time.zonedToUtc(date, 23 * 60, TZ);
    const r = await M.h.handleSendReminder({ appointmentId: a.id, offsetMin: 1440, startsAt: a.startsAt.toISOString() }, { now: night });
    expect(r.status).toBe("sent");
  });

  it("aylık kredi: ayda bir kez (idempotent), sonraki ay yeniden", async () => {
    const s = await mkSalon("pro");
    const next = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 15)); // gelecek yıl → bu ay verilmemiş
    const before = await balance(s);
    const r1 = await M.credits.grantMonthlyCredits(next, { tenantIds: [s.tenantId] });
    expect(r1).toMatchObject({ checked: 1, granted: 1, credited: 300 });
    const r2 = await M.credits.grantMonthlyCredits(new Date(next.getTime() + 5 * 86_400_000), { tenantIds: [s.tenantId] });
    expect(r2.granted).toBe(0);
    await Promise.all([M.credits.grantMonthlyCreditsFor(s.tenantId, next), M.credits.grantMonthlyCreditsFor(s.tenantId, next)]);
    expect(await balance(s)).toBe(before + 300);
    const rows = await M.db.prisma.smsLedger.findMany({ where: { tenantId: s.tenantId, note: { startsWith: "monthly:" } } });
    expect(rows).toHaveLength(1);
    const month2 = new Date(Date.UTC(next.getUTCFullYear(), 1, 1));
    expect(await M.credits.grantMonthlyCreditsFor(s.tenantId, month2)).toBe(300);
    expect(await balance(s)).toBe(before + 600);
    // askıdaki salon almaz
    await M.db.prisma.tenant.update({ where: { id: s.tenantId }, data: { status: "suspended" } });
    expect(await M.credits.grantMonthlyCreditsFor(s.tenantId, new Date(Date.UTC(next.getUTCFullYear(), 2, 1)))).toBe(0);
  });

  it("manuel ödeme yeni dönem kredisini verir (bu ay verilmediyse), tekrarında vermez", async () => {
    const s = await mkSalon("pro");
    const future = new Date(Date.UTC(new Date().getUTCFullYear() + 2, 5, 10));
    const before = await balance(s);
    await M.pay.recordManualPayment({ id: s.userId }, { tenantId: s.tenantId, amountTry: 1250, months: 1 }, future);
    expect(await balance(s)).toBe(before + 300);
    await M.pay.recordManualPayment({ id: s.userId }, { tenantId: s.tenantId, amountTry: 1250, months: 1 }, new Date(future.getTime() + 86_400_000));
    expect(await balance(s)).toBe(before + 300);
  });

  it("OTP kredi düşer (notification), MessageLog'da kod maskeli", async () => {
    const s = await mkSalon();
    const before = await balance(s);
    await M.otp.sendOtp(s.tenantId, "+905331140001", "654321");
    const [row] = await logs(s, { template: "otp" });
    expect(row!.content).not.toContain("654321");
    expect(row!.content).toContain("******");
    expect(await balance(s)).toBe(before - row!.cost);
    const led = await M.db.prisma.smsLedger.findFirst({ where: { tenantId: s.tenantId, messageId: row!.id } });
    expect(led?.reason).toBe("notification");
  });

  it("OTP: kredi yok → geliştirmede devam, üretimde sms_unavailable", async () => {
    const s = await mkSalon();
    await drain(s);
    await expect(M.otp.sendOtp(s.tenantId, "+905331140002", "111111")).resolves.toBeUndefined();
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      await expect(M.otp.sendOtp(s.tenantId, "+905331140002", "111111")).rejects.toMatchObject({ code: "sms_unavailable" });
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
  });

  it("askıdaki salonda panel yazma suspended (423) olur, okuma serbest; audit yazılır", async () => {
    const s = await mkSalon("pro");
    const ctx = await M.sess.resolveTenantUser({ user: { id: s.userId, role: "owner", tenantId: s.tenantId } });
    const svc = await M.cat.createService(ctx, { nameTr: "Boya", durationMin: 60, priceTry: 800, bufferMin: 0, active: true, sortOrder: 0, staffIds: [s.staffId] });
    const audit = await M.db.prisma.auditLog.findMany({ where: { tenantId: s.tenantId, action: "service.create" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: s.userId, actorRole: "owner" });
    expect(audit[0]!.details).toMatchObject({ id: svc.id });

    await M.db.prisma.tenant.update({ where: { id: s.tenantId }, data: { status: "suspended" } });
    const sus = await M.sess.resolveTenantUser({ user: { id: s.userId, role: "owner", tenantId: s.tenantId } });
    await expect(M.cat.createService(sus, { nameTr: "X", durationMin: 30, priceTry: 1, bufferMin: 0, active: true, sortOrder: 0, staffIds: [] })).rejects.toMatchObject({ code: "suspended" });
    await expect(M.cat.updateService(sus, svc.id, { nameTr: "Y" })).rejects.toMatchObject({ code: "suspended" });
    await expect(M.cat.createStaff(sus, { name: "Z", color: "#2563eb", active: true, sortOrder: 0 })).rejects.toMatchObject({ code: "suspended" });
    const set = await import("@/lib/panel/settings");
    await expect(set.updateSettings(sus, { cancelHoursBefore: 5 })).rejects.toMatchObject({ code: "suspended" });
    const ap = await import("@/lib/panel/appointments");
    await expect(ap.setAppointmentStatus(sus, "x", "completed")).rejects.toMatchObject({ code: "suspended" });
    expect((await M.cat.listServices(sus)).length).toBeGreaterThan(0); // okuma serbest
    expect((await set.getSettings(sus)).status).toBe("suspended");
    const { statusForCode } = await import("@/lib/http");
    expect(statusForCode("suspended")).toBe(423);
    const { assertWritable } = await import("@/lib/panel-auth");
    expect(() => assertWritable(sus)).toThrow();
    expect(() => assertWritable(ctx)).not.toThrow();
  });

  it("ayar/personel/saat/izin değişiklikleri AuditLog'a yazılır", async () => {
    const s = await mkSalon("pro");
    const ctx = await M.sess.resolveTenantUser({ user: { id: s.userId, role: "owner", tenantId: s.tenantId } });
    const set = await import("@/lib/panel/settings");
    await set.updateSettings(ctx, { cancelHoursBefore: 3 });
    const st = await M.cat.createStaff(ctx, { name: "Veli", color: "#2563eb", active: true, sortOrder: 0 });
    await M.cat.updateStaff(ctx, st.id, { name: "Veli2" });
    await M.cat.setWorkingHours(ctx, st.id, { days: [{ weekday: 1, startMin: 540, endMin: 1020, breaks: [] }] });
    const to = await M.cat.createTimeOff(ctx, { staffId: st.id, startsAt: new Date("2030-01-01T10:00:00Z"), endsAt: new Date("2030-01-01T12:00:00Z"), kind: "leave" });
    await M.cat.deleteTimeOff(ctx, to.id);
    await M.cat.deleteStaff(ctx, st.id);
    const actions = (await M.db.prisma.auditLog.findMany({ where: { tenantId: s.tenantId, actorId: s.userId } })).map((a) => a.action).sort();
    expect(actions).toEqual(["settings.update", "staff.create", "staff.delete", "staff.update", "time_off.create", "time_off.delete", "working_hours.set"].sort());
  });
});
