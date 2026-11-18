/**
 * Demo verisi (T-006). `pnpm db:seed`; idempotent: salon slug ile upsert edilir, demo içeriği (personel,
 * hizmet, müşteri, randevu, defter) her çalıştırmada silinip bugüne göre yeniden üretilir.
 * Üretimde yalnız SEED_DEMO=true ise çalışır.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Customer, Service, Staff } from "@prisma/client";
import { PLANS, type PlanId } from "../config/plans";
import { prisma } from "../lib/db";
import { addDays, utcToLocal, weekdayOf, zonedToUtc } from "../lib/time";

const TZ = "Asia/Famagusta";
const DEMO_PASSWORD = "demo12345";
const ADMIN_PASSWORD = "admin12345";

interface SvcDef { tr: string; en: string; dur: number; price: number; buffer: number }
interface SalonDef {
  slug: string; name: string; city: string; address: string; phone: string; color: string; plan: PlanId;
  staff: { name: string; color: string }[];
  services: SvcDef[];
}

const SALONS: SalonDef[] = [
  {
    slug: "lefkosa-usta-berber", name: "Lefkoşa Usta Berber", city: "Lefkoşa",
    address: "Girne Caddesi No:42", phone: "+905338001001", color: "#465635", plan: "pro",
    staff: [
      { name: "Hasan Usta", color: "#1d4ed8" },
      { name: "Mert Kaya", color: "#0f766e" },
      { name: "Emre Demir", color: "#b45309" },
    ],
    services: [
      { tr: "Saç Kesimi", en: "Haircut", dur: 30, price: 450, buffer: 5 },
      { tr: "Sakal Tıraşı", en: "Beard Trim", dur: 20, price: 250, buffer: 0 },
      { tr: "Saç + Sakal", en: "Haircut + Beard", dur: 50, price: 650, buffer: 5 },
      { tr: "Cilt Bakımı", en: "Facial Care", dur: 40, price: 600, buffer: 10 },
      { tr: "Damat Tıraşı", en: "Groom Package", dur: 90, price: 1800, buffer: 15 },
      { tr: "Çocuk Tıraşı", en: "Kids Haircut", dur: 25, price: 300, buffer: 0 },
    ],
  },
  {
    slug: "girne-glow-kuafor", name: "Girne Glow Kuaför", city: "Girne",
    address: "Ecevit Caddesi No:8", phone: "+905428002002", color: "#9b4835", plan: "salon_plus",
    staff: [
      { name: "Ayşe Karaca", color: "#be185d" },
      { name: "Elif Yılmaz", color: "#7c3aed" },
      { name: "Sarah Thompson", color: "#0891b2" },
    ],
    services: [
      { tr: "Kadın Saç Kesimi", en: "Women's Haircut", dur: 45, price: 700, buffer: 5 },
      { tr: "Fön", en: "Blow Dry", dur: 30, price: 400, buffer: 0 },
      { tr: "Saç Boyama", en: "Hair Colouring", dur: 120, price: 2200, buffer: 15 },
      { tr: "Röfle / Balyaj", en: "Highlights / Balayage", dur: 150, price: 3200, buffer: 15 },
      { tr: "Manikür", en: "Manicure", dur: 45, price: 500, buffer: 5 },
      { tr: "Kalıcı Oje", en: "Gel Polish", dur: 60, price: 650, buffer: 10 },
    ],
  },
];

const CUSTOMERS: { name: string; phone: string; locale: "tr" | "en" }[] = [
  { name: "Ahmet Özkan", phone: "+905331112201", locale: "tr" },
  { name: "Murat Şahin", phone: "+905331112202", locale: "tr" },
  { name: "Selin Aksoy", phone: "+905421112203", locale: "tr" },
  { name: "Deniz Çelik", phone: "+905421112204", locale: "tr" },
  { name: "Burak Koç", phone: "+905481112205", locale: "tr" },
  { name: "Zeynep Arslan", phone: "+905481112206", locale: "tr" },
  { name: "Can Yıldız", phone: "+905321112207", locale: "tr" },
  { name: "Ece Polat", phone: "+905551112208", locale: "tr" },
  { name: "Okan Erdem", phone: "+905061112209", locale: "tr" },
  { name: "James Walker", phone: "+447700900301", locale: "en" },
  { name: "Emily Clarke", phone: "+447700900302", locale: "en" },
  { name: "Oliver Reid", phone: "+447700900303", locale: "en" },
];

type Status = "completed" | "no_show" | "cancelled_by_customer" | "cancelled_by_salon" | "confirmed" | "pending";
const PAST: Status[] = ["completed", "completed", "completed", "completed", "completed", "no_show", "cancelled_by_customer", "completed", "cancelled_by_salon", "completed"];
const FUTURE: Status[] = ["confirmed", "confirmed", "confirmed", "pending", "confirmed", "confirmed", "cancelled_by_customer", "confirmed"];

async function resetDemo(tenantId: string) {
  await prisma.appointment.deleteMany({ where: { tenantId } });
  await prisma.messageLog.deleteMany({ where: { tenantId } });
  await prisma.otp.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.timeOff.deleteMany({ where: { tenantId } });
  await prisma.workingHours.deleteMany({ where: { tenantId } });
  await prisma.serviceStaff.deleteMany({ where: { tenantId } });
  await prisma.service.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.smsLedger.deleteMany({ where: { tenantId } });
}

async function seedSalon(def: SalonDef, now: Date, passwordHash: string) {
  const plan = PLANS[def.plan];
  const data = {
    name: def.name, city: def.city, address: def.address, phone: def.phone, brandColor: def.color,
    timeZone: TZ, plan: def.plan, status: "active" as const,
    subscriptionEndsAt: new Date(now.getTime() + 30 * 86_400_000),
    smsSenderName: def.name.replace(/[^A-Za-z]/g, "").slice(0, 11) || null,
  };
  const tenant = await prisma.tenant.upsert({ where: { slug: def.slug }, create: { slug: def.slug, ...data }, update: data });
  await resetDemo(tenant.id);

  await prisma.user.upsert({
    where: { email: `owner@${def.slug}.test` },
    create: { email: `owner@${def.slug}.test`, passwordHash, name: `${def.name} Sahibi`, role: "owner", tenantId: tenant.id },
    update: { passwordHash, tenantId: tenant.id, role: "owner" },
  });
  await prisma.smsLedger.create({
    data: { tenantId: tenant.id, delta: plan.monthlySms, reason: "plan_monthly", balanceAfter: plan.monthlySms, note: "Demo aylık kredi" },
  });

  const staff: Staff[] = [];
  for (const [i, s] of def.staff.entries()) {
    staff.push(await prisma.staff.create({ data: { tenantId: tenant.id, name: s.name, color: s.color, sortOrder: i } }));
  }
  const services: Service[] = [];
  for (const [i, s] of def.services.entries()) {
    services.push(await prisma.service.create({
      data: { tenantId: tenant.id, nameTr: s.tr, nameEn: s.en, durationMin: s.dur, priceTry: s.price, bufferMin: s.buffer, sortOrder: i },
    }));
  }
  // Her hizmeti en az iki personel verir (kıdemli personel hepsini)
  for (const [si, sv] of services.entries()) {
    for (const [pi, st] of staff.entries()) {
      if (pi === 0 || (si + pi) % 2 === 0) {
        await prisma.serviceStaff.create({ data: { tenantId: tenant.id, serviceId: sv.id, staffId: st.id } });
      }
    }
  }
  // Pzt–Cmt 09:00–19:00, mola 13:00–13:30; Pazar kapalı
  for (const st of staff) {
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      await prisma.workingHours.create({
        data: { tenantId: tenant.id, staffId: st.id, weekday, startMin: 540, endMin: 1140, breaks: [[780, 810]] },
      });
    }
  }
  const customers: Customer[] = [];
  for (const c of CUSTOMERS) {
    const optIn: boolean = customers.length % 3 === 0;
    customers.push(await prisma.customer.create({
      data: {
        tenantId: tenant.id, name: c.name, phone: c.phone, locale: c.locale,
        email: customers.length % 2 === 0 ? `${c.name.toLowerCase().replace(/[^a-z]/g, "")}@example.test` : null,
        kvkkAcceptedAt: now, marketingConsent: optIn, marketingConsentAt: optIn ? now : null,
      },
    }));
  }

  // 30 randevu: 15 geçmiş (son 2 hafta) + 15 gelecek (önümüzdeki 2 hafta); personel başına ardışık, çakışmasız
  const today = utcToLocal(now, TZ).date;
  const days = (from: number, to: number) => {
    const out: string[] = [];
    for (let n = from; n <= to; n++) {
      const d = addDays(today, n);
      if (weekdayOf(d) !== 0) out.push(d);
    }
    return out;
  };
  const pastDays = days(-14, -1);
  const futureDays = days(1, 14);
  let made = 0;
  const sideCount = (future: boolean) =>
    prisma.appointment.count({ where: { tenantId: tenant.id, startsAt: future ? { gte: now } : { lt: now } } });
  const book = async (dates: string[], count: number, statuses: Status[], seed: number, future: boolean) => {
    for (let k = 0; k < count; k++) {
      if ((await sideCount(future)) >= 15) return;
      const date = dates[(k * 5 + seed) % dates.length]!;
      const st = staff[(k + seed) % staff.length]!;
      const sv = services[(k * 2 + seed) % services.length]!;
      const slotNo = Math.floor(k / dates.length) + Math.floor(k / staff.length) % 3; // aynı gün/personele farklı slot
      const startMin = 540 + ((k * 3 + seed + slotNo * 4) % 8) * 60 + (k % 2) * 30; // 09:00–16:30 arası, öğle molasından kaçınmak için aşağıda kontrol
      const startMinAdj = startMin >= 750 && startMin < 810 ? 840 : startMin;
      const startsAt = zonedToUtc(date, startMinAdj, TZ);
      const endsAt = new Date(startsAt.getTime() + sv.durationMin * 60_000);
      const blockedUntil = new Date(endsAt.getTime() + sv.bufferMin * 60_000);
      const overlap = await prisma.appointment.findFirst({
        where: { staffId: st.id, startsAt: { lt: blockedUntil }, blockedUntil: { gt: startsAt } }, select: { id: true },
      });
      if (overlap) continue;
      const status = statuses[k % statuses.length]!;
      const cust = customers[(k * 7 + seed) % customers.length]!;
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id, staffId: st.id, serviceId: sv.id, customerId: cust.id,
          startsAt, endsAt, blockedUntil, status,
          source: k % 5 === 0 ? "walk_in" : k % 4 === 0 ? "panel" : "online",
          cancelToken: randomBytes(24).toString("hex"), priceTry: sv.priceTry,
          cancelledAt: status.startsWith("cancelled") ? now : null,
        },
      });
      made++;
      if (status === "no_show") await prisma.customer.update({ where: { id: cust.id }, data: { noShowCount: { increment: 1 } } });
    }
  };
  // fazla deneme ile çakışanlar atlandığında bile 30'a ulaşmak için döngü
  for (let round = 0; made < 30 && round < 6; round++) {
    const needPast = Math.max(0, 15 - (await prisma.appointment.count({ where: { tenantId: tenant.id, startsAt: { lt: now } } })));
    const needFuture = Math.max(0, 15 - (await prisma.appointment.count({ where: { tenantId: tenant.id, startsAt: { gte: now } } })));
    if (needPast + needFuture === 0) break;
    await book(pastDays, needPast + 2, PAST, round * 3, false);
    await book(futureDays, needFuture + 2, FUTURE, round * 3 + 1, true);
  }
  const total = await prisma.appointment.count({ where: { tenantId: tenant.id } });
  console.log(`  ${def.name}: ${staff.length} personel, ${services.length} hizmet, ${customers.length} müşteri, ${total} randevu`);
}

async function main() {
  const demo = process.env.SEED_DEMO === "true";
  if (process.env.NODE_ENV === "production" && !demo) {
    console.log("Üretimde seed çalışmaz (SEED_DEMO=true verilmedi).");
    return;
  }
  const now = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  // E2E betiklerinden kalan test salonlarını temizle (randevular cascade değil → önce onlar)
  const stale = { tenant: { slug: { startsWith: "e2e-" } } };
  await prisma.appointment.deleteMany({ where: stale });
  const gone = await prisma.tenant.deleteMany({ where: { slug: { startsWith: "e2e-" } } });
  if (gone.count) console.log(`${gone.count} artık e2e salonu silindi.`);
  console.log("Demo salonlar yükleniyor…");
  for (const def of SALONS) await seedSalon(def, now, passwordHash);

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: "admin@kibrisrandevu.test" },
    create: { email: "admin@kibrisrandevu.test", passwordHash: adminHash, name: "Süper Admin", role: "superadmin" },
    update: { passwordHash: adminHash, role: "superadmin", tenantId: null },
  });
  console.log("Süper-admin: admin@kibrisrandevu.test / admin12345");
  console.log("Salon sahipleri: owner@<slug>.test / demo12345");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
