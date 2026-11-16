/**
 * Başsız tarayıcı kontrolü (mobil 375×812). Test çalıştırıcısı gerekmez:
 *   pnpm db:seed && pnpm build && pnpm start        # ayrı terminalde (varsayılan :3000)
 *   node tests/e2e/booking.cjs                       # BASE_URL, SHOT_DIR, SLUG ortam değişkenleriyle ayarlanır
 * Playwright global kuruluysa `require('playwright')` çalışır (tarayıcı indirmeyi bu betik yapmaz).
 */
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUG = process.env.SLUG || "lefkosa-usta-berber";
const SHOTS = process.env.SHOT_DIR || os.tmpdir();
const shot = (n) => path.join(SHOTS, `ui-${n}.png`);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "tr-TR" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  const step = (m) => console.log(`✓ ${m}`);

  // ── pazarlama ana sayfası
  await page.goto(`${BASE}/`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.match(await page.locator("h1").innerText(), /Lefkoşa'dan İskele'ye/);
  assert.ok(await page.getByText("TL/ay").count() >= 3, "3 plan fiyatı");
  await page.screenshot({ path: shot("home") });
  step("/ açıldı (hero + fiyatlar)");

  // dil anahtarı
  await page.getByRole("button", { name: "English" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.match(await page.locator("h1").innerText(), /Nicosia to Iskele/);
  await page.getByRole("button", { name: "Türkçe" }).first().click();
  await page.waitForFunction(() => document.documentElement.lang === "tr");
  step("TR/EN anahtarı çalışıyor");

  // ── giriş + kayıt sayfaları
  await page.goto(`${BASE}/giris`);
  await page.getByLabel("E-posta").first().waitFor();
  step("/giris açıldı");
  await page.goto(`${BASE}/kayit`);
  await page.getByLabel("Adınız soyadınız").fill("Test Kullanıcı");
  await page.getByLabel("E-posta").fill("test@example.test");
  await page.getByLabel("Şifre").fill("sifre12345");
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByLabel("Salon adı").fill("Lefkoşa Usta Berber");
  await page.getByText("Bu adres kullanımda.").waitFor();
  await page.getByLabel("Randevu sayfası adresi").fill(`e2e-yeni-${Date.now().toString(36)}`);
  await page.getByText("Bu adres müsait.").waitFor();
  step("/kayit sihirbazı: slug canlı kontrolü (kullanımda → müsait)");

  // ── randevu akışı
  await page.goto(`${BASE}/${SLUG}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.ok(await page.getByRole("link", { name: "Yol tarifi" }).getAttribute("href").then((h) => h.includes("google.com/maps")));
  assert.equal(await page.locator("iframe").count(), 0, "gömülü harita yok");
  assert.ok((await page.locator('script[type="application/ld+json"]').innerText()).includes('"telephone"'), "JSON-LD");
  await page.getByRole("button", { name: /Saç Kesimi/ }).first().click();
  await page.getByRole("button", { name: "Devam" }).click();
  await page.getByRole("button", { name: /Fark etmez/ }).click();
  await page.getByRole("button", { name: "Devam" }).click();

  // iptal edilebilir olsun diye en az yarın; boş saat olan ilk günü bul
  const dayCount = await page.locator("button.w-16").count();
  let picked = null;
  for (let i = 1; i < Math.min(dayCount, 10); i++) {
    await page.locator("button.w-16").nth(i).click();
    await page.waitForFunction(() => !document.body.innerText.includes("Saatler yükleniyor"));
    const slots = page.locator("button.min-h-11[aria-pressed]");
    if (await slots.count()) { picked = slots.first(); break; }
  }
  assert.ok(picked, "boş saat bulunamadı (seed çalıştı mı?)");
  const time = (await picked.innerText()).trim();
  await picked.click();
  await page.screenshot({ path: shot("booking-slots") });
  step(`saat seçildi: ${time}`);
  await page.getByRole("button", { name: "Devam" }).click();

  // KVKK zorunlu
  await page.getByLabel("Ad soyad").fill("E2E Test");
  await page.getByLabel("Telefon").fill("+90 533 999 00 11");
  await page.getByRole("button", { name: "Randevuyu onayla" }).click();
  await page.getByText("aydınlatma metnini onaylamanız gerekir").waitFor();
  const marketing = page.getByLabel(/Kampanya ve duyuru/);
  assert.equal(await marketing.isChecked(), false, "pazarlama izni varsayılan işaretsiz");
  step("KVKK işaretlenmeden gönderim engellendi; pazarlama kutusu işaretsiz");
  await page.getByRole("checkbox", { name: /Aydınlatma metnini/ }).check();
  await page.getByRole("button", { name: "Randevuyu onayla" }).click();

  await page.getByRole("heading", { name: "Randevunuz alındı" }).waitFor();
  const cancelHref = await page.getByTestId("cancel-link").getAttribute("href");
  assert.match(cancelHref, /^\/r\/[\w-]{16,}/);
  await page.screenshot({ path: shot("booking-success") });
  step(`başarı ekranı + iptal bağlantısı ${cancelHref.slice(0, 12)}…`);

  // ── /r/[token]: özet + iptal
  await page.goto(`${BASE}${cancelHref}`);
  assert.match(await page.getByTestId("status").innerText(), /Onaylandı/);
  await page.getByTestId("cancel-button").click();
  await page.getByTestId("cancel-confirm").click();
  await page.getByText("Randevunuz iptal edildi.").waitFor();
  await page.reload();
  assert.match(await page.getByTestId("status").innerText(), /ptal ettiniz/);
  step("/r/[token] özeti ve iptal çalıştı");

  // ── 404
  const r404 = await page.goto(`${BASE}/yok-boyle-salon-xyz`);
  assert.equal(r404.status(), 404);
  step("olmayan salon 404");

  const noise = problems.filter((p) => !/status of 404/.test(p)); // 404 sayfasının kaynak hatası
  assert.deepEqual(noise, [], `konsol hataları:\n${noise.join("\n")}`);
  console.log("TAMAM — konsol hatası yok");
  await browser.close();
})().catch((e) => { console.error("BAŞARISIZ:", e); process.exit(1); });
