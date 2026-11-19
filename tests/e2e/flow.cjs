/**
 * T-082: uçtan uca akış (başsız tarayıcı, mobil 375×812):
 *   /kayit sihirbazı ile yeni salon → panelde hizmet ekle → müşteri herkese açık sayfadan randevu alır
 *   → hatırlatma işi pg-boss kuyruğunda (pgboss.job) planlandı → /r/{token} ile iptal → durum iptal.
 *
 *   pnpm build
 *   NEXTAUTH_SECRET=... JOBS_QUEUE=pgboss pnpm start      # ayrı terminalde (varsayılan :3000); iş kuyruğu AÇIK olmalı
 *   node tests/e2e/flow.cjs                                # BASE_URL, SHOT_DIR; DATABASE_URL .env'den okunur
 *
 * Her çalıştırma benzersiz bir salon açar (seed gerekmez, tekrar çalıştırılabilir). Worker çalışmasa da olur:
 * iş yalnızca "planlandı" olarak doğrulanır. Playwright global kuruluysa `require('playwright')` çalışır.
 */
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

try { process.loadEnvFile(path.join(__dirname, "..", "..", ".env")); } catch { /* .env yok: ortamdan */ }
const { PrismaClient } = require("@prisma/client");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOT_DIR || os.tmpdir();
const shot = (n) => path.join(SHOTS, `flow-${n}.png`);
const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const SLUG = `e2e-flow-${uid}`;
const EMAIL = `flow-${uid}@example.test`;
const PASSWORD = "sifre12345";

(async () => {
  const prisma = new PrismaClient();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "tr-TR" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) problems.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  const step = (m) => console.log(`✓ ${m}`);
  const jobsOf = (appointmentId) => prisma.$queryRawUnsafe(
    `SELECT name, state, singleton_key, start_after FROM pgboss.job WHERE data->>'appointmentId' = $1 ORDER BY name, start_after`, appointmentId);

  try {
    // ── 1) kayıt sihirbazı (hizmet eklemeden bitir; hizmet panelden eklenecek)
    await page.goto(`${BASE}/kayit`);
    await page.getByLabel("Adınız soyadınız").fill("Flow Sahip");
    await page.getByLabel("E-posta").fill(EMAIL);
    await page.getByLabel("Şifre").fill(PASSWORD);
    await page.getByRole("button", { name: "Devam" }).click();
    await page.getByLabel("Salon adı").fill(`E2E Flow ${uid}`);
    await page.getByLabel("Randevu sayfası adresi").fill(SLUG);
    await page.getByText("Bu adres müsait.").waitFor();
    await page.getByRole("button", { name: "Devam" }).click();
    await page.getByLabel("Her gün 09:00–18:00").check(); // 3. adım: tüm günler, yarın için slot garantisi
    await page.getByRole("button", { name: "Devam" }).click();
    await page.getByRole("button", { name: "Salonumu oluştur" }).click(); // 4. adım: hizmet seçmeden
    await page.waitForURL((u) => u.pathname === "/panel", { timeout: 30000 });
    const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true, trialEndsAt: true } });
    assert.ok(tenant, "salon DB'de");
    assert.equal(await prisma.staff.count({ where: { tenantId: tenant.id } }), 1, "sahibi ilk personel olarak eklendi");
    assert.ok(await prisma.workingHours.count({ where: { tenantId: tenant.id } }) >= 7, "çalışma saatleri yazıldı");
    step(`kayıt tamam → /panel (salon ${SLUG})`);

    // ── 2) panelde hizmet ekle
    // Hold staff data to reproduce the loading race without timing-based sleeps.
    let releaseStaff;
    const staffReady = new Promise((resolve) => { releaseStaff = resolve; });
    await page.route("**/api/panel/staff", async (route) => { await staffReady; await route.continue(); });
    await page.goto(`${BASE}/panel/hizmetler`);
    const addService = page.getByRole("button", { name: /Hizmet ekle/ }).first();
    await addService.waitFor();
    try { assert.equal(await addService.isDisabled(), true, "personel yüklenmeden hizmet formu açılmaz"); }
    finally { releaseStaff(); }
    await addService.click();
    await page.unroute("**/api/panel/staff");
    await page.getByLabel("Hizmet adı (Türkçe)").fill("Saç Kesimi");
    await page.getByLabel("Süre (dk)", { exact: true }).fill("30");
    await page.getByLabel("Fiyat (TL)").fill("450");
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    await page.getByText("Saç Kesimi").first().waitFor();
    assert.equal(await prisma.serviceStaff.count({ where: { service: { tenantId: tenant.id } } }), 1, "hizmet personele bağlı");
    step("panelde hizmet eklendi (Saç Kesimi)");

    // ── 3) müşteri herkese açık sayfadan randevu alır (yeni, çerezsiz bağlam)
    const cctx = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: "tr-TR" });
    const cp = await cctx.newPage();
    cp.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) problems.push(`customer console: ${m.text()}`); });
    cp.on("pageerror", (e) => problems.push(`customer pageerror: ${e.message}`));
    await cp.goto(`${BASE}/${SLUG}`);
    await cp.getByRole("button", { name: /Saç Kesimi/ }).first().click();
    await cp.getByRole("button", { name: "Devam" }).click();
    await cp.getByRole("button", { name: /Fark etmez/ }).click();
    await cp.getByRole("button", { name: "Devam" }).click();
    const dayCount = await cp.locator("button.w-16").count();
    let picked = null;
    for (let i = 1; i < Math.min(dayCount, 10); i++) { // yarın ve sonrası: iptal/hatırlatma için ileri tarih
      await cp.locator("button.w-16").nth(i).click();
      await cp.waitForFunction(() => !document.body.innerText.includes("Saatler yükleniyor"));
      const slots = cp.locator("button.min-h-11[aria-pressed]");
      if (await slots.count()) { picked = slots.first(); break; }
    }
    assert.ok(picked, "boş saat bulunamadı");
    await picked.click();
    await cp.getByRole("button", { name: "Devam" }).click();
    await cp.getByLabel("Ad soyad").fill("Flow Müşteri");
    await cp.getByLabel("Telefon").fill("+90 533 111 22 33");
    await cp.getByRole("checkbox", { name: /Aydınlatma metnini/ }).check();
    await cp.getByRole("button", { name: "Randevuyu onayla" }).click();
    await cp.getByRole("heading", { name: "Randevunuz alındı" }).waitFor();
    const cancelHref = await cp.getByTestId("cancel-link").getAttribute("href");
    assert.match(cancelHref, /^\/r\/[\w-]{16,}/);
    await cp.screenshot({ path: shot("success") });
    const token = cancelHref.replace(/^\/r\//, "");
    const appt = await prisma.appointment.findUnique({ where: { cancelToken: token } });
    assert.ok(appt, "randevu DB'de");
    assert.equal(appt.tenantId, tenant.id);
    assert.ok(["pending", "confirmed"].includes(appt.status), `durum aktif (${appt.status})`);
    step(`müşteri randevu aldı (${appt.startsAt.toISOString()}, ${appt.status})`);

    // ── 4) hatırlatma işi kuyrukta (pg-boss): kuyruk yazımı istek sonrası tamamlanmış olabilir, kısa bekle
    let jobs = [];
    for (let i = 0; i < 20; i++) { jobs = await jobsOf(appt.id); if (jobs.some((j) => j.name === "send-reminder")) break; await new Promise((r) => setTimeout(r, 500)); }
    const reminders = jobs.filter((j) => j.name === "send-reminder");
    assert.ok(reminders.length >= 1, `send-reminder işi planlanmalı (JOBS_QUEUE=pgboss ile çalıştırın). Bulunan: ${JSON.stringify(jobs)}`);
    for (const j of reminders) {
      assert.ok(new Date(j.start_after) < appt.startsAt, "hatırlatma randevudan önce çalışacak");
      assert.ok(String(j.singleton_key).startsWith(`rem:${appt.id}:`), "idempotency anahtarı rem:{id}:{ofset}:{başlangıç}");
    }
    assert.ok(jobs.some((j) => j.name === "send-confirmation"), "onay mesajı işi planlandı");
    step(`kuyrukta ${reminders.length} hatırlatma + onay işi planlandı (${reminders.map((j) => j.state).join(",")})`);

    // ── 5) /r/{token} ile iptal
    await cp.goto(`${BASE}${cancelHref}`);
    assert.match(await cp.getByTestId("status").innerText(), /Onaylandı|Bekliyor/);
    await cp.getByTestId("cancel-button").click();
    await cp.getByTestId("cancel-confirm").click();
    await cp.getByText("Randevunuz iptal edildi.").waitFor();
    const after = await prisma.appointment.findUnique({ where: { id: appt.id } });
    assert.equal(after.status, "cancelled_by_customer", "DB'de iptal");
    await cp.reload();
    assert.match(await cp.getByTestId("status").innerText(), /ptal ettiniz/);
    // panel API'si de iptali görür
    const listed = await page.evaluate(async (d) => (await fetch(`/api/panel/appointments?from=${d}&to=${d}`)).json(), appt.startsAt.toISOString().slice(0, 10));
    const row = (listed.appointments || []).find((a) => a.id === appt.id);
    if (row) assert.equal(row.status, "cancelled_by_customer", "panelde iptal görünür");
    step("/r/{token} ile iptal edildi → durum cancelled_by_customer");
    await cctx.close();

    const noise = problems.filter((p) => !/status of 404/.test(p));
    assert.deepEqual(noise, [], `konsol hataları:\n${noise.join("\n")}`);
    console.log("TAMAM — flow.cjs (kayıt → hizmet → randevu → hatırlatma kuyruğu → iptal)");
  } finally {
    // oluşturduğumuz salonu sil: Appointment→Staff/Service/Customer cascade değil, önce randevular
    await prisma.appointment.deleteMany({ where: { tenant: { slug: SLUG } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { slug: SLUG } }).catch((e) => console.error("temizlik başarısız:", e.message));
    await prisma.$disconnect().catch(() => {});
    await browser.close();
  }
})().catch((e) => { console.error("BAŞARISIZ:", e); process.exit(1); });
