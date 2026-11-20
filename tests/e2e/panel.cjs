/**
 * Başsız tarayıcı kontrolü: salon paneli + süper-admin (mobil 375×812, takvim için bir de 1280×800).
 *   pnpm db:seed && pnpm build && pnpm start        # ayrı terminalde (varsayılan :3000)
 *   node tests/e2e/panel.cjs                         # BASE_URL, SHOT_DIR, SLUG ortam değişkenleri
 * Not: takvim randevularını kendi fixture'ı oluşturup temizler; ödeme/kredi/hizmet adımları demo verisini değiştirir.
 */
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "lefkosa-usta-berber";
const SHOTS = process.env.SHOT_DIR || os.tmpdir();
const shot = (n) => path.join(SHOTS, `${n}.png`);

async function login(page, email, password) {
  await page.goto(`${BASE}/giris`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/giris"), { timeout: 20000 });
}


/** Bugün randevu yoksa (seed bazı günleri boş bırakır) randevusu olan ilk güne gider. */
async function gotoDayWithAppointments(page) {
  await page.getByTestId("cal-col").first().waitFor();
  const has = () => page.waitForFunction(() => document.querySelectorAll('[data-testid="appt-block"][data-status="pending"], [data-testid="appt-block"][data-status="confirmed"]').length > 0, null, { timeout: 4000 }).then(() => true, () => false);
  if (await has()) return;
  const date = await page.evaluate(async () => {
    const d0 = new Date(); const f = (d) => d.toISOString().slice(0, 10);
    const to = new Date(d0.getTime() + 20 * 864e5);
    const r = await fetch(`/api/panel/appointments?from=${f(d0)}&to=${f(to)}`).then((x) => x.json());
    const a = r.appointments.find((x) => x.status === "pending" || x.status === "confirmed");
    return a ? new Intl.DateTimeFormat("en-CA", { timeZone: r.timeZone }).format(new Date(a.startsAt)) : null;
  });
  assert.ok(date, "yakın günlerde randevu var");
  // özel tarih seçici: düğmeyi aç, ayı hedef aya getir, günü ISO tarihinden bulunan etiketle seç
  await page.getByRole("button", { name: /^(Tarih|Date)/ }).first().click();
  for (let i = 0; i < 3; i++) {
    const cell = page.getByRole("dialog").locator("button[role=gridcell]").filter({ hasText: new RegExp(`^${Number(date.slice(8))}$`) });
    const n = await cell.count();
    if (n) { const d = new Date(`${date}T12:00:00Z`); const lab = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d); const t = page.getByRole("dialog").getByLabel(lab, { exact: true }); if (await t.count()) { await t.click(); break; } }
    await page.getByRole("button", { name: "Sonraki ay" }).click();
  }
  assert.ok(await has(), "seçilen günde randevu blokları");
}

function calendarFixtureCommand(mode, fixture) {
  const code = `try{process.loadEnvFile('.env')}catch{};import {createPanelCalendarFixture,cleanupPanelCalendarFixture} from './tests/fixtures/panel-calendar';const task=process.env.KR_PANEL_MODE==='create'?createPanelCalendarFixture(process.env.KR_PANEL_SLUG):cleanupPanelCalendarFixture(JSON.parse(process.env.KR_PANEL_FIXTURE));task.then(x=>{console.log(JSON.stringify(x??null));process.exit(0)}).catch(()=>process.exit(1));`;
  try {
    const output = execFileSync(process.env.KR_PNPM || (existsSync('/tmp/kr-pnpm') ? '/tmp/kr-pnpm' : 'pnpm'), ['exec','tsx','-e',code], { env: {...process.env, KR_PANEL_MODE:mode, KR_PANEL_SLUG:SLUG, KR_PANEL_FIXTURE:JSON.stringify(fixture??null), SMS_PROVIDER:'mock', ALLOW_REAL_SMS:'false', JOBS_QUEUE:'none'}, stdio:'pipe' });
    return JSON.parse(String(output).trim().split('\n').at(-1));
  } catch { throw new Error(`Panel calendar fixture ${mode} failed`); }
}
(async () => {
  let browser, calendarFixture;
  try {
  calendarFixture = calendarFixtureCommand('create');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  const problems = [];
  const watch = (page) => {
    // beklenen 4xx (ör. mesai dışı walk-in → 422) tarayıcı konsoluna "Failed to load resource" düşer; yok sayılır
    page.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) problems.push(`console: ${m.text()}`); });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  };
  const step = (m) => console.log(`✓ ${m}`);
  const mobile = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "tr-TR" };

  // ───────────── salon sahibi (mobil)
  const octx = await browser.newContext(mobile);
  const page = await octx.newPage();
  watch(page);
  await login(page, `owner@${SLUG}.test`, "demo12345");
  await page.goto(`${BASE}/panel`);
  await gotoDayWithAppointments(page);
  assert.ok(await page.locator('nav[aria-label="Panel menüsü"]').last().isVisible(), "alt sekme çubuğu");
  assert.match(await page.locator("header").first().innerText(), /SMS/, "SMS rozeti");
  assert.equal(await page.getByRole("link", { name: /Takvim/ }).last().getAttribute("aria-current"), "page");
  await page.locator('[data-testid="appt-block"]').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  await page.screenshot({ path: shot("panel-calendar") });
  step("takvim açıldı, randevular görünüyor");

  // tarih seçici: TR biçimi, klavye (ok/PageDown/Esc) ve odak dönüşü
  {
    const dbtn = page.getByRole("button", { name: /^Tarih/ }).first();
    assert.match(await dbtn.innerText(), /^\d{2}\.\d{2}\.\d{4}$/, "tarih GG.AA.YYYY");
    await dbtn.focus(); await page.keyboard.press("Enter");
    const dd = page.getByRole("dialog");
    await dd.waitFor();
    const lab = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    const l0 = await lab(); await page.keyboard.press("ArrowRight");
    assert.notEqual(await lab(), l0, "ArrowRight odağı kaydırır");
    await page.keyboard.press("PageDown");
    assert.match(await dd.locator("[aria-live]").innerText(), /^(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) \d{4}$/, "ay başlığı Türkçe");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup")), "dialog", "Esc sonrası odak düğmede");
    step("tarih seçici klavye + TR biçimi");
  }

  // bir randevuyu aç → Onayla (bekleyense) → Tamamlandı
  const block = page.locator('[data-testid="appt-block"][data-status="pending"], [data-testid="appt-block"][data-status="confirmed"]').first();
  await block.scrollIntoViewIfNeeded();
  await block.click();
  const dlg = page.getByRole("dialog");
  await dlg.waitFor();
  if (await dlg.getByRole("button", { name: "Onayla" }).count()) {
    await dlg.getByRole("button", { name: "Onayla" }).click();
    await page.getByText("Randevu güncellendi.").first().waitFor();
  }
  await dlg.getByRole("button", { name: "Tamamlandı" }).click();
  await page.getByText("Randevu güncellendi.").first().waitFor();
  await dlg.waitFor({ state: "detached" });
  await page.locator('[data-testid="appt-block"][data-status="completed"]').first().waitFor();
  step("randevu onaylandı → Tamamlandı");

  // yeni randevu
  await page.getByRole("button", { name: /\+ Randevu/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Müşteri", { exact: true }).fill("E2E Deneme");
  await page.getByLabel("Telefon").fill("+90 533 111 22 33");
  await page.getByLabel("Yürüyen müşteri (şimdi)").check();
  await page.getByRole("button", { name: "Randevu oluştur" }).click();
  const created = await Promise.race([
    page.getByText("Randevu oluşturuldu.").first().waitFor({ timeout: 8000 }).then(() => "ok"),
    page.getByRole("dialog").getByRole("alert").first().waitFor({ timeout: 8000 }).then(() => "refused"),
  ]).catch(() => "none");
  console.log(`  (walk-in randevu sonucu: ${created} — mesai dışıysa reddedilmesi beklenir)`);
  if (created !== "ok") await page.keyboard.press("Escape");

  // hizmet ekle
  await page.goto(`${BASE}/panel/hizmetler`);
  await page.getByRole("button", { name: /\+ Hizmet ekle/ }).click();
  await page.getByLabel("Hizmet adı (Türkçe)").fill("E2E Cilt Bakımı");
  await page.getByLabel("Fiyat (TL)").fill("450");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await page.getByText("E2E Cilt Bakımı").first().waitFor();
  step("hizmet eklendi");

  // personel + saat editörü açılıyor
  await page.goto(`${BASE}/panel/personel`);
  await page.getByRole("button", { name: "Çalışma saatleri" }).first().click();
  await page.getByRole("dialog").getByText("Pazartesi").first().waitFor();
  await page.keyboard.press("Escape");
  step("personel + çalışma saatleri");

  // müşteriler
  await page.goto(`${BASE}/panel/musteriler`);
  await page.locator("ul li button").first().waitFor();
  await page.getByLabel("Müşteri ara").fill("zzzz-yok");
  await page.getByText("Müşteri bulunamadı.").waitFor();
  await page.getByLabel("Müşteri ara").fill("");
  await page.locator("ul li button").first().click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("dialog").getByText(/kez gelmedi/).waitFor();
  await page.keyboard.press("Escape");
  step("müşteriler: arama + ayrıntı");

  // raporlar (Pro+ ise veri, değilse paket notu)
  await page.goto(`${BASE}/panel/raporlar`);
  await page.getByText(/Toplam randevu|Pro paketinde/).first().waitFor();
  step("raporlar açıldı");

  // ayar değiştir
  await page.goto(`${BASE}/panel/ayarlar`);
  await page.getByLabel("İptal kuralı (saat)").waitFor();
  await page.getByLabel("İptal kuralı (saat)").fill("6");
  await page.getByLabel("SMS gönderilebilen ülke kodları", { exact: true }).fill("90, 44");
  await page.getByLabel("Randevu ve doğrulama SMS günlük sınırı (segment)", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Kaydet" }).last().click();
  await page.getByText("Kaydedildi.").first().waitFor();
  await page.reload();
  await page.getByLabel("İptal kuralı (saat)").waitFor();
  assert.equal(await page.getByLabel("İptal kuralı (saat)").inputValue(), "6");
  assert.equal(await page.getByLabel("SMS gönderilebilen ülke kodları", { exact: true }).inputValue(), "90, 44");
  assert.equal(await page.getByLabel("Randevu ve doğrulama SMS günlük sınırı (segment)", { exact: true }).inputValue(), "150");
  assert.ok((await page.getByTestId("public-url").innerText()).endsWith(`/${SLUG}`), "public link");
  await page.getByTestId("sms-balance").scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("panel-settings") });
  step("ayar kaydedildi ve kalıcı");

  // sahip /admin'e giremez
  await page.goto(`${BASE}/admin`);
  assert.ok(!new URL(page.url()).pathname.startsWith("/admin"), "owner /admin'den yönlendirilir");
  step("owner /admin'den yönlendirildi");
  const ownerState = await octx.storageState(); // masaüstü bağlamı aynı oturumu kullanır (girişte IP hız sınırı var)
  await octx.close();

  // ───────────── takvim masaüstü + sürükle-bırak
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "tr-TR", storageState: ownerState });
  const dp = await dctx.newPage();
  watch(dp);
  await dp.goto(`${BASE}/panel`);
  await gotoDayWithAppointments(dp);
  await dp.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  assert.ok(await dp.locator("aside").isVisible(), "masaüstü kenar çubuğu");
  await dp.screenshot({ path: shot("panel-calendar-desktop") });
  step("masaüstü takvim");
  const pend = dp.locator('[data-testid="appt-block"][data-status="pending"], [data-testid="appt-block"][data-status="confirmed"]').first();
  if (await pend.count()) {
    await pend.scrollIntoViewIfNeeded();
    const b = await pend.boundingBox();
    if (b) {
      await dp.mouse.move(b.x + b.width / 2, b.y + 6);
      await dp.mouse.down();
      await dp.mouse.move(b.x + b.width / 2, b.y + 6 + 60, { steps: 6 });
      await dp.mouse.up();
      const r = await Promise.race([
        dp.getByText("Randevu taşındı.").first().waitFor({ timeout: 6000 }).then(() => "taşındı"),
        dp.locator('[role="alert"]').first().waitFor({ timeout: 6000 }).then(() => "reddedildi+geri alındı"),
      ]).catch(() => "belirsiz");
      console.log(`  (sürükle-bırak sonucu: ${r})`);
    }
  }
  await dctx.close();

  // ───────────── süper-admin (mobil)
  const actx = await browser.newContext(mobile);
  const ap = await actx.newPage();
  watch(ap);
  await login(ap, "admin@kibrisrandevu.test", "admin12345");
  await ap.goto(`${BASE}/admin`);
  await ap.getByRole("heading", { name: "Salonlar" }).waitFor();
  await ap.getByTestId("mrr").waitFor();
  await ap.getByRole("link", { name: /Lefko/ }).first().waitFor();
  await ap.screenshot({ path: shot("admin-tenants") });
  step("/admin salon listesi + gelir kartları");

  await ap.getByRole("link", { name: /Lefko/ }).first().click();
  await ap.getByRole("heading", { name: "Manuel ödeme kaydı" }).waitFor();
  const before = Number(await ap.getByTestId("sms-balance").innerText());
  await ap.getByLabel("Tutar (TL)").fill("750");
  await ap.getByRole("button", { name: "Ödemeyi kaydet" }).click();
  await ap.getByRole("dialog").getByRole("button", { name: "Ödemeyi kaydet" }).click();
  await ap.getByTestId("payments").getByText(/750/).first().waitFor();
  step("manuel ödeme kaydedildi");

  await ap.getByLabel("Kredi miktarı").fill("100");
  await ap.getByRole("button", { name: "Kredi yükle" }).first().click();
  await ap.getByRole("dialog").getByRole("button", { name: "Kredi yükle" }).click();
  await ap.waitForFunction((b) => Number(document.querySelector('[data-testid="sms-balance"]')?.textContent) >= b + 100, before);
  step("SMS kredisi eklendi");

  await ap.goto(`${BASE}/admin/denetim`);
  await ap.getByTestId("audit-list").getByText("payment.record").first().waitFor();
  await ap.getByTestId("audit-list").getByText("sms.credit").first().waitFor();
  step("denetim kaydında ödeme + kredi");
  await ap.goto(`${BASE}/admin/sms`);
  await ap.getByRole("heading", { name: "SMS talepleri" }).waitFor();
  await ap.goto(`${BASE}/admin/fiyatlar`);
  await ap.getByLabel(/Pro \(TL/).waitFor();
  step("SMS talepleri + fiyatlar açıldı");
  await actx.close();

  await browser.close(); browser = undefined;
  assert.deepEqual(problems, [], `konsol hataları:\n${problems.join("\n")}`);
  step("konsol hatası yok");
  } finally {
    try { await browser?.close(); } finally { if(calendarFixture) calendarFixtureCommand('cleanup',calendarFixture); }
  }
})().catch((e) => { console.error(e); process.exit(1); });
