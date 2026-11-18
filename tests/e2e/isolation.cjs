/**
 * T-081: tenant izolasyonu, gerçek HTTP üzerinden (tarayıcı sayfası yok; Playwright yalnız çerezli HTTP istemcisi).
 * Salon A'nın sahibi, salon B'nin randevu/müşteri kimlikleriyle panel API'sini çağırır → her zaman 404 (varlığı sızmaz).
 * Ayrıca staff rolü rapor/müşteri ayrıntısına erişemez (403) ve oturumsuz çağrı 401.
 *
 *   pnpm build && NEXTAUTH_SECRET=... pnpm start     # ayrı terminalde (varsayılan :3000)
 *   node tests/e2e/isolation.cjs                      # BASE_URL; DATABASE_URL .env'den (staff kullanıcısı için)
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const { request } = require("playwright");

try { process.loadEnvFile(path.join(__dirname, "..", "..", ".env")); } catch { /* .env yok */ }
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const PASSWORD = "sifre12345";
const step = (m) => console.log(`✓ ${m}`);
const json = { "content-type": "application/json" };

/** Salon kaydı (API) + Auth.js kimlik bilgisi girişi (csrf + callback); çerezler istemcide kalır. */
async function mkSalon(tag) {
  const slug = `e2e-iso-${tag}-${uid}`;
  const email = `iso-${tag}-${uid}@example.test`;
  const api = await request.newContext({ baseURL: BASE });
  const su = await api.post("/api/auth/signup", { headers: json, data: { email, password: PASSWORD, name: `Sahip ${tag}`, salonName: `Iso ${tag} ${uid}`, city: "Girne", slug } });
  assert.equal(su.status(), 201, `signup ${tag}: ${await su.text()}`);
  await login(api, email);
  const staff = await (await api.post("/api/panel/staff", { headers: json, data: { name: `Usta ${tag}` } })).json();
  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 540, endMin: 1080, breaks: [] }));
  assert.ok((await api.put(`/api/panel/staff/${staff.id}/working-hours`, { headers: json, data: { days } })).ok());
  const svc = await (await api.post("/api/panel/services", { headers: json, data: { nameTr: "Saç Kesimi", durationMin: 30, priceTry: 300, staffIds: [staff.id] } })).json();
  assert.ok(svc.id, "hizmet oluştu");
  return { tag, slug, email, api, staffId: staff.id, serviceId: svc.id };
}

async function login(api, email) {
  const { csrfToken } = await (await api.get("/api/auth/csrf")).json();
  const res = await api.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password: PASSWORD, json: "true" }, maxRedirects: 0,
  });
  assert.ok(res.status() < 400, `giriş ${email}: ${res.status()}`);
  const me = await (await api.get("/api/auth/session")).json();
  assert.ok(me && me.user, `oturum açıldı (${email})`);
}

/** Herkese açık API ile randevu al (yarın ve sonrası ilk boş slot). */
async function book(s, name, phone) {
  const pub = await request.newContext({ baseURL: BASE });
  for (let d = 1; d <= 6; d++) {
    const date = new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
    const sl = await (await pub.get(`/api/public/${s.slug}/slots?serviceId=${s.serviceId}&staffId=any&date=${date}`)).json();
    if (!sl.slots || !sl.slots.length) continue;
    const r = await pub.post(`/api/public/${s.slug}/appointments`, {
      headers: json,
      data: { serviceId: s.serviceId, staffId: sl.slots[0].staffIds[0], startsAt: sl.slots[0].startsAt, customer: { name, phone }, kvkkAccepted: true, marketingConsent: false },
    });
    assert.equal(r.status(), 201, `randevu ${s.tag}: ${await r.text()}`);
    return r.json();
  }
  throw new Error("boş slot yok");
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const A = await mkSalon("a");
    const B = await mkSalon("b");
    step("iki salon kuruldu ve iki sahip de giriş yaptı");

    const bk = await book(B, "B Müşterisi", "+90 533 222 33 44");
    const bAppt = await prisma.appointment.findFirst({ where: { tenant: { slug: B.slug } }, orderBy: { createdAt: "desc" } });
    assert.ok(bAppt, "B'nin randevusu var");
    const bCustomer = bAppt.customerId;
    void bk;

    // B kendi randevusunu görebilir (kontrol: 404'ler yetki yüzünden değil izolasyon yüzünden)
    assert.equal((await B.api.get(`/api/panel/appointments/${bAppt.id}`)).status(), 200, "B kendi randevusunu görür");
    assert.equal((await B.api.get(`/api/panel/customers/${bCustomer}`)).status(), 200, "B kendi müşterisini görür");

    // not yazma Pro+ özelliğidir (Başlangıç'ta plan kontrolü 402 verir); izolasyonu görmek için A'yı Pro'ya al
    await prisma.tenant.update({ where: { slug: A.slug }, data: { plan: "pro" } });

    // A → B'nin kaynakları: hepsi 404
    const deny = [
      ["GET", `/api/panel/appointments/${bAppt.id}`],
      ["PATCH", `/api/panel/appointments/${bAppt.id}`, { startsAt: new Date(bAppt.startsAt.getTime() + 3_600_000).toISOString() }],
      ["POST", `/api/panel/appointments/${bAppt.id}/status`, { status: "cancelled_by_salon" }],
      ["GET", `/api/panel/customers/${bCustomer}`],
      ["PATCH", `/api/panel/customers/${bCustomer}`, { notes: "ele geçirildi" }],
      ["PATCH", `/api/panel/services/${B.serviceId}`, { nameTr: "Hack" }],
      ["DELETE", `/api/panel/services/${B.serviceId}`],
      ["PUT", `/api/panel/staff/${B.staffId}/working-hours`, { days: [] }],
    ];
    for (const [method, url, data] of deny) {
      const r = await A.api.fetch(url, { method, headers: json, ...(data ? { data } : {}) });
      assert.equal(r.status(), 404, `A ${method} ${url} → ${r.status()} (404 beklenir)`);
    }
    step(`A sahibi B'nin randevu/müşteri/hizmet/personel kimlikleriyle ${deny.length} çağrı yaptı → hepsi 404`);

    // A'nın randevu listesi B'nin randevusunu içermez
    const day = bAppt.startsAt.toISOString().slice(0, 10);
    const list = await (await A.api.get(`/api/panel/appointments?from=${day}&to=${day}`)).json();
    assert.ok(!(list.appointments || []).some((a) => a.id === bAppt.id), "A listesinde B randevusu yok");
    const custs = await (await A.api.get("/api/panel/customers?q=B")).json();
    assert.ok(!(custs.customers || []).some((c) => c.id === bCustomer), "A müşteri aramasında B müşterisi yok");

    // B'nin verisi dokunulmamış
    const still = await prisma.appointment.findUnique({ where: { id: bAppt.id } });
    assert.equal(still.status, bAppt.status);
    assert.equal(still.startsAt.getTime(), bAppt.startsAt.getTime());
    assert.equal((await prisma.customer.findUnique({ where: { id: bCustomer } })).notes, null);
    step("B verisi değişmedi; A'nın liste/aramasında B yok");

    // oturumsuz → 401
    const anon = await request.newContext({ baseURL: BASE });
    for (const url of [`/api/panel/appointments/${bAppt.id}`, `/api/panel/customers/${bCustomer}`, "/api/panel/reports?month=2026-11"]) {
      assert.equal((await anon.get(url)).status(), 401, `oturumsuz ${url}`);
    }
    step("oturumsuz çağrılar 401");

    // staff rolü: rapor + müşteri ayrıntısı 403, arama minimal
    const tenantA = await prisma.tenant.findUnique({ where: { slug: A.slug } });
    const staffEmail = `iso-staff-${uid}@example.test`;
    await prisma.user.create({ data: { email: staffEmail, name: "Personel", role: "staff", tenantId: tenantA.id, passwordHash: await bcrypt.hash(PASSWORD, 10) } });
    const sa = await request.newContext({ baseURL: BASE });
    await login(sa, staffEmail);
    const aBook = await book(A, "A Müşterisi", "+90 533 555 66 77");
    void aBook;
    const aCust = (await prisma.customer.findFirst({ where: { tenantId: tenantA.id } })).id;
    assert.equal((await sa.get("/api/panel/reports?month=2026-11")).status(), 403, "staff rapor 403");
    assert.equal((await sa.get(`/api/panel/customers/${aCust}`)).status(), 403, "staff müşteri ayrıntısı 403");
    assert.equal((await sa.patch(`/api/panel/customers/${aCust}`, { headers: json, data: { notes: "x" } })).status(), 403, "staff not 403");
    assert.equal((await sa.get("/api/panel/customers")).status(), 400, "staff: sorgusuz müşteri listesi yok");
    const found = await (await sa.get("/api/panel/customers?q=A%20M%C3%BC%C5%9Fteri")).json();
    assert.ok(found.customers.length >= 1 && found.customers.every((c) => Object.keys(c).sort().join() === "id,name,phone"), "staff araması yalnız id/ad/telefon");
    step("staff: rapor/müşteri ayrıntısı/not 403, arama minimal (id, ad, telefon)");

    console.log("TAMAM — isolation.cjs (tenant izolasyonu + staff yetkileri, gerçek HTTP)");
  } finally {
    // oluşturduğumuz salonları sil (hata olsa da): önce randevular (Staff/Service/Customer ilişkisi cascade değil)
    try {
      await prisma.appointment.deleteMany({ where: { tenant: { slug: { startsWith: `e2e-iso-` , endsWith: `-${uid}` } } } });
      await prisma.tenant.deleteMany({ where: { slug: { startsWith: `e2e-iso-` , endsWith: `-${uid}` } } });
    } catch (e) { console.error("temizlik başarısız:", e.message); }
    await prisma.$disconnect().catch(() => {});
  }
})().catch((e) => { console.error("BAŞARISIZ:", e); process.exit(1); });
