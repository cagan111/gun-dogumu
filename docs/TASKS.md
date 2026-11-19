# Görev panosu

Biçim: `- [ ] T-NNN | sahip: claude|codex|- | açıklama`. Başlamadan sahip yaz ve commit et.

## M1 – İskelet
- [x] T-001 | sahip: claude | Next.js + TS strict + pnpm iskeleti, lint/typecheck/test script'leri, `pnpm ci`
  - `pnpm run ci` (pnpm'in kendi `ci` komutu var; script adı korunup `run` ile çağrılır).
- [x] T-002 | sahip: claude | Prisma şeması (tüm veri modeli) + ilk migration + exclusion constraint
  - Exclusion constraint init migration'da (btree_gist).
- [x] T-003 | sahip: claude | `lib/db.ts` + `withTenant()` yardımcısı + birim testi
  - `lib/tenant.ts` scopeArgs + `withTenant()` extension; 5 birim testi.
- [x] T-004 | sahip: claude | `/api/health` (DB ping) + pino logger
  - DB ping, 503 düşüş; pino.
- [x] T-005 | sahip: claude | `config/brand.ts`, `config/plans.ts`, `.env.example`
- [x] T-006 | sahip: claude | Seed: 2 salon × 3 personel, 6 hizmet, 30 randevu (`SEED_DEMO`)
  - `prisma/seed.ts` (`pnpm db:seed`): 2 salon × 3 personel × 6 hizmet, 30 randevu/salon (çakışmasız, karışık durum), owner@<slug>.test/demo12345, SEED_DEMO/NODE_ENV korumalı süper-admin; tekrar çalıştırılabilir (demo içeriği sıfırlanıp bugüne göre üretilir).
- [x] T-007 | sahip: claude | Dockerfile + docker-compose (app, postgres, caddy, yedek) + Caddyfile
  - `Dockerfile` (deps/build/runner, standalone, kullanıcı `node`), `docker-entrypoint.sh` (migrate deploy → SEED_DEMO ise seed → web; `worker` rolü), `docker-compose.yml` (app, worker, db, caddy, backup), `Caddyfile` (`CADDY_SITE`); `lib/env.ts` açılış doğrulaması. Sandbox'ta daemon başlatılıp compose ayağa kalktı, `/api/health` Caddy :80 üzerinden 200 (bkz. DECISIONS).
- [x] T-008 | sahip: claude | GitHub Actions CI (lint, typecheck, test, Postgres servisli)
  - `.github/workflows/ci.yml`: Node 22, pnpm (packageManager 10.28), postgres:16 servisi, `prisma migrate deploy`, `pnpm run ci`, `pnpm build` (sahte NEXTAUTH_SECRET).

## M2 – Müşteri randevu akışı
- [x] T-010 | sahip: claude | `lib/time.ts` saat dilimi yardımcıları + testler
  - `lib/time.ts` Intl tabanlı; DST boşluğu ileri kaydırılır, çift saat ilk anına çözülür; 11 test.
- [x] T-011 | sahip: claude | `lib/availability.ts` müsaitlik motoru + kapsamlı testler (gece yarısı, mola, izin, tampon, en erken/en geç)
  - `lib/availability.ts` `computeAvailability` saf fonksiyon; endMin>1440 taşan vardiya, 27 test.
- [x] T-012 | sahip: claude | `lib/booking.ts` randevu oluşturma (transaction + çakışma, "fark etmez" personel ataması)
  - `lib/booking.ts` `createAppointment`/`cancelByToken`, SlotTakenError; 8 gerçek-DB testi (`booking.db.test.ts`).
- [x] T-013 | sahip: claude | Public API: salon bilgisi, hizmetler, personel, slotlar, randevu oluştur (Zod)
  - `app/api/public/[slug]/{,services,staff,slots,appointments}`; mantık `lib/public.ts`, askıda 423, POST IP başına 10/saat.
- [x] T-014 | sahip: claude | `lib/phone.ts` E.164 doğrulama (KKTC/TR/UK) + testler
  - `lib/phone.ts` `normalizePhone`/`isKktcMobile`/`phoneSchema`; 6 test.
- [x] T-015 | sahip: claude | İptal token'ı + `/r/{token}` API (X saat kuralı)
  - `GET /api/r/[token]`, `POST /api/r/[token]/cancel` (`lib/cancel.ts`).
- [x] T-016 | sahip: claude | OTP (hash'li, 5 dk, rate limit) + "Randevularım" API
  - `lib/otp.ts` + `otp/request`, `otp/verify`, `my-appointments`; imzalı çerez 30 dk; `sendOtp()` yalnız loglar (T-050 TODO).
- [x] T-017 | sahip: claude | `/[salonSlug]` 4 adımlı randevu arayüzü (mobil, klavye erişilebilir)
  - `app/(public)/[salonSlug]` tek sayfa 4 adım (hizmet → uzman → gün/saat → bilgiler), sabit alt çubuk, 409/423/404 işleme; `booking-flow.tsx`.
- [x] T-018 | sahip: claude | Onay ekranı, `/r/{token}` iptal sayfası, Randevularım sayfası
  - Başarı ekranı + iptal bağlantısı, `app/r/[token]` özet/iptal, `randevularim` OTP akışı.
- [x] T-019 | sahip: claude | Aydınlatma metni linki + işaretsiz pazarlama izni kutusu
  - Zorunlu KVKK onayı (/gizlilik bağlantılı) + işaretsiz pazarlama izni kutusu.
- [x] T-020 | sahip: claude | i18n altyapısı (tr/en sözlükleri, dil seçimi)
  - `lib/i18n/{tr,en,shared,index,client}`: en, tr anahtarlarının tamamını içermek zorunda (tip); `getLocale/getT/translate`, `I18nProvider/useT`, `LangSwitcher`.

## M3 – Salon paneli
- [x] T-030 | sahip: claude | Auth.js: e-posta+şifre, sihirli bağlantı, rol/tenant oturumu, rate limit
  - `auth.ts` (Credentials + magic-link sağlayıcısı, JWT userId/role/tenantId), `lib/session.ts`, `middleware.ts`, `LoginToken` migration'ı; sihirli bağlantı e-posta yerine loga.
- [x] T-031 | sahip: claude | Kayıt + salon oluşturma API'si (slug benzersizliği, 14 gün deneme)
  - `POST /api/auth/signup`, `GET /api/auth/slug-check`; tenant+owner+SMS kredisi tek transaction'da, çakışmada 409.
- [x] T-032 | sahip: claude | Kayıt sihirbazı arayüzü (ad, şehir, slug, saatler, ilk hizmetler)
  - `/giris`, `/giris/sihirli`, `/sifre-belirle`, `/kayit` 4 adımlı sihirbaz (saatler + hizmetler kayıt+girişten sonra panel API'siyle yazılır; hata olursa `/panel?onboarding=1`); `/panel` ve `/admin` yer tutucu.
- [x] T-033 | sahip: claude | Panel API: randevu listele/ekle/taşı/durum (gelmedi), tenant korumalı
  - `app/api/panel/appointments` (GET liste, POST ekle, `[id]` GET/PATCH taşı, `[id]/status`); servis `lib/panel/appointments.ts`, panelden `bypassLeadRules` (çakışma/mesai asla atlanmaz), gelmedi sayacı atomik.
- [x] T-034 | sahip: claude | Takvim (günlük/haftalık, personel sütunları, sürükle-bırak)
  - `app/panel` kabuğu (`_ui/shell`) + `_ui/calendar` gün/hafta, sürükle-bırak (pointer events, 409/422 geri alma), randevu sayfası, + Randevu; i18n `lib/i18n/panel-{tr,en}.ts`.
- [x] T-035 | sahip: claude | Panel API: hizmet, personel, çalışma saati, izin CRUD
  - `/api/panel/{services,staff,time-off}` + `staff/[id]/working-hours` (PUT); yazma yalnız owner (`assertOwner`, servis katmanında), plan `maxStaff` → 402 `plan_limit`; servis `lib/panel/catalog.ts`, mola doğrulama `lib/hours.ts`.
- [x] T-036 | sahip: claude | Hizmet/personel/saat/izin ekranları
  - `/panel/hizmetler` (`_ui/services`), `/panel/personel` (`_ui/staff`: ekle/düzenle, 7 günlük saat editörü + mola, izin listesi/ekle); staff rolünde yazma kontrolleri gizli, plan_limit 402 mesajı.
- [x] T-037 | sahip: claude | Müşteri API: arama, geçmiş, not, gelmedi sayısı
  - `GET /api/panel/customers` (q, sayfalı), `GET/PATCH /api/panel/customers/[id]` (notlar Pro+, Başlangıç → 402 `plan_feature`); `lib/panel/customers.ts`.
- [x] T-038 | sahip: claude | Müşteri listesi ekranı
  - `/panel/musteriler` (`_ui/customers`): arama, sayfalama, ayrıntı + notlar (plan_feature → "Pro paketinde"), `?id=` ile açılır.
- [x] T-039 | sahip: claude | Ayarlar API (SMS başlığı, hatırlatma zamanları, iptal kuralı, görünüm)
  - `/api/panel/settings` (GET/PATCH owner), `/api/panel/sms/{requests,balance}`; bakiye kanonik `lib/ledger.ts` (tenant satırı FOR UPDATE; eşzamanlı düşüm testi); `lib/panel/settings.ts`.
- [x] T-040 | sahip: claude | Ayarlar ekranı + SMS bakiye kartı + paket talep butonu
  - `/panel/ayarlar` (`_ui/settings`): public link+kopyala, SMS kartı (bakiye, 500/1000/5000 talep, 409 yinelenen), Salon+ kampanya (canlı segment sayacı `smsSegments`), ayar formu.
- [x] T-041 | sahip: claude | Rapor API (randevu sayısı, ciro tahmini, en çok hizmet/personel, gelmeme oranı)
  - `GET /api/panel/reports?month=YYYY-MM` (Pro+); `lib/panel/reports.ts` (salon saat dilimiyle ay, ciro = completed + geçmiş confirmed).
- [x] T-042 | sahip: claude | Rapor ekranı
  - `/panel/raporlar` (`_ui/reports`): ay seçici, durum/hizmet/personel CSS çubukları, ciro, gelmeme oranı; plan_feature notu.

## M4 – Bildirimler
- [x] T-050 | sahip: claude | `lib/messaging` MessageProvider + Mock + Netgsm + İletiMerkezi + GenericHttp + WhatsAppCloud
  - `lib/messaging/{types,providers,registry,send}.ts`: Mock/Netgsm/İletiMerkezi/GenericHttp/WhatsAppCloud + MockEmail; `ALLOW_REAL_SMS=true` kapısı, kapalıyken Mock'a düşer; her gönderim MessageLog yazar.
- [x] T-051 | sahip: claude | SMS segment hesabı (GSM-7 / Türkçe tek-kaydırma / UCS-2) + testler
  - `lib/messaging/segments.ts` `smsSegments` (gsm7 160/153, gsm7_tr 155/149, ucs2 70/67, profil ayarlı); 16 test.
- [x] T-052 | sahip: claude | SmsLedger: bakiye, düşüm, iade, aylık plan kredisi + testler
  - `sendMessage` kredi düşümü + MessageLog aynı transaction (`debitTx`), hata → iade; `grantMonthlyCredits(now)` ayda bir (not `monthly:YYYY-MM`), `recordManualPayment` sonrası tetiklenir.
- [x] T-053 | sahip: claude | Şablonlar tr/en (onay, 24s, 2s, iptal, değişiklik)
  - `lib/messaging/templates.ts` tr/en 11 şablon + kampanya çıkış ifadesi, `formatWhen` salon saat diliminde; uzunluk/segment testleri.
- [x] T-054 | sahip: claude | pg-boss işleri: hatırlatma zamanlama/iptal, idempotency, sessiz saatler
  - `jobs/{queue,boss,handlers,worker}.ts` (`pnpm worker`), saf `planReminders` + `onAppointmentChanged`, anahtar `rem:{id}:{ofset}:{startsAt}`; işleyici taşınma/iptal/yinelenme kontrolü; testte MemoryQueue.
- [x] T-055 | sahip: claude | Kredi bitince e-posta/WhatsApp'a düşme + salona uyarı
  - Kredi yetmezse WhatsApp (Salon+, yapılandırılmışsa) → e-posta → atlandı kaydı; salona günde bir `low_credit` e-postası (anahtarlı).
- [x] T-056 | sahip: claude | Kampanya SMS'i (Salon+, yalnız izinli, çıkış ifadesi)
  - `sendCampaign` (`lib/messaging/campaign.ts`) + `POST /api/panel/campaigns` (owner); Salon+, yalnız izinli, çıkış ifadesi, sessiz saat `quiet_hours` (409), kredi önceden kontrol.

## M5 – Süper-admin ve gelir
- [x] T-060 | sahip: claude | Süper-admin API: salonlar, manuel ödeme → abonelik uzatma, SMS paketi → defter, AuditLog
  - `/api/admin/{tenants,tenants/[id],…/plan,…/suspend,…/unsuspend,payments,sms-credits,sms-requests,sms-requests/[id],plan-prices,revenue,audit}`; `lib/admin/service.ts`, `lib/billing/payments.ts`; her mutasyon AuditLog (actorId).
- [x] T-061 | sahip: claude | `/admin` ekranları (liste, ödeme, kredi, audit)
  - `app/admin` (layout superadmin kapısı) + `_ui`: salon listesi+gelir kartları, `/admin/salon/[id]` (manuel ödeme, kredi, paket, askı, ödemeler), `/admin/sms`, `/admin/fiyatlar`, `/admin/denetim`; yıkıcı işlemlerde onay penceresi.
- [x] T-062 | sahip: claude | Abonelik durum makinesi (trial → active → past_due 7 gün → suspended) + uyarı işleri
  - `lib/billing/subscription.ts` `nextStatus` (saf) + `applySubscriptionTick` (AuditLog + tekrarsız uyarı listesi); zamanlanmış çağrı T-054/pg-boss işinde yapılacak.
- [x] T-063 | sahip: claude | Gelir özeti (MRR, aktif salon, satılan SMS)
  - `GET /api/admin/revenue` (`revenueSummary`: MRR güncel plan fiyatlarıyla, durum sayıları, bu ay satılan SMS) + `PATCH /api/admin/plan-prices`, `getPlanPrice()` (`lib/plan-price.ts`).
- [x] T-064 | sahip: claude | `PaymentProvider` arayüzü + `manual`
  - `lib/billing/payment-provider.ts`: `PaymentProvider`, `ManualPaymentProvider`, iyzico/PayTR `not_configured` taslakları.
- [x] T-065 | sahip: claude | İlk açılışta SUPERADMIN_EMAIL hesabı + şifre bağlantısı loga
  - `lib/bootstrap.ts` `ensureSuperadmin()` (`instrumentation.ts`'ten), `POST /api/auth/set-password`; bağlantı pino warn ile loga.

## M6 – Pazarlama ve SEO
- [x] T-070 | sahip: claude | `/` ana sayfa TR/EN (özellikler, fiyatlar, SSS, CTA, WhatsApp)
  - `/` TR/EN: hero, özellikler, fiyatlar (getAllPlanPrices), SSS, CTA, CONTACT_WHATSAPP (boşsa gizli).
- [x] T-071 | sahip: claude | Salon sayfası SEO (meta, OG, LocalBusiness JSON-LD)
  - Salon sayfası generateMetadata (başlık/açıklama/OG/canonical) + HairSalon JSON-LD.
- [x] T-072 | sahip: claude | Gizlilik + kullanım koşulları şablon sayfaları
  - `/gizlilik`, `/kosullar` taslak şablonlar (KKTC 89/2007; "taslak – avukat kontrolü gerekir").

## Güvenlik ve kalite
- [x] T-080 | sahip: claude | Rate limit yardımcısı (bellek/DB) + güvenlik başlıkları + CSRF
  - `lib/ratelimit.ts` (arayüz + bellek uygulaması, `setRateLimiter`), `lib/http.ts` (hata→HTTP, Zod 400, IP); güvenlik başlıkları zaten `next.config.mjs`'te; CSRF: oturum çerezi SameSite=Lax + JSON API, ayrı token yok.
- [x] T-081 | sahip: claude | e2e tenant izolasyon testi (başka salon ID → 404)
  - `tests/e2e/isolation.cjs`: gerçek HTTP, A→B kimlikleriyle 8 çağrı hep 404, oturumsuz 401, staff 403; `next start` üzerinde yeşil.
- [x] T-082 | sahip: claude | e2e: kayıt → hizmet → randevu → hatırlatma kuyrukta → iptal
  - `tests/e2e/flow.cjs`: kayıt → hizmet → randevu → `pgboss.job`'da send-reminder/confirmation → iptal; `JOBS_QUEUE=pgboss next start` ile yeşil.
- [x] T-083 | sahip: claude | Günlük pg_dump yedeği (14 gün) + RUNBOOK geri yükleme
  - `backup` servisi (`scripts/backup-loop.sh`): açılışta + her 24 sa `pg_dump -Fc` → `./backups`, 14 gün tutulur; geri yükleme RUNBOOK §5.
- [x] T-084 | sahip: claude | `docs/RUNBOOK.md` (başlatma, güncelleme, log, SMS sağlayıcı değiştirme)
  - `docs/RUNBOOK.md` (kurulum, başlatma, süper-admin bağlantısı, güncelleme, yedek/geri yükleme, log, SMS sağlayıcı, sorun giderme).
- [ ] T-085 | sahip: codex | Lighthouse mobil ölçümü (randevu sayfası > 85)

## Ek (inceleme sonrası)
- [x] T-090 | sahip: claude | Askıya alınmış (suspended) salonda panel yazma işlemlerini engelle (okuma serbest)
  - `ctx.tenantStatus` + `assertWritable` (servis katmanı) ve `panelRoute` yazma yöntemlerinde 423 `suspended`; okuma serbest.
- [x] T-091 | sahip: claude | Panel değişikliklerini (hizmet, ayar, personel) AuditLog'a yaz
  - `lib/panel/audit.ts` `auditPanel`: hizmet/personel/saat/izin/ayar/kampanya AuditLog (actorId = kullanıcı).
- [x] T-092 | sahip: claude | Ödeme/ay yenilemede planın aylık SMS kredisini deftere ekle (T-052 ile)
  - T-052 ile birlikte: `grantMonthlyCreditsFor` ödeme sonrası ve günlük işte; aynı ay ikinci kez verilmez.

## Ek (kod incelemesi sonrası)
- [x] T-093 | sahip: claude | Flaky DB testi: eşzamanlı `sendMessage` 40P01 kilitlenmesi
  - Kök neden: aynı transaction'da önce `MessageLog` INSERT (Tenant FK → KEY SHARE) sonra `SELECT … FOR UPDATE` (ledger); iki işlem birbirini bekliyordu. Kilit sırası sabitlendi (önce tenant FOR UPDATE), regresyon testi eklendi.
- [x] T-094 | sahip: claude | Güvenlik: staff rolü rapor ve müşteri verisine erişemez
  - Rapor, müşteri ayrıntısı ve not yazma yalnız owner (`assertOwner`, servis katmanı); staff yalnız ≥3 karakterli ad/telefon araması yapar (≤8 sonuç, {id, ad, telefon}); DB testi.
- [x] T-095 | sahip: claude | Mobil takvim cilası
  - Yatay kaydırma + yapışkan saat sütunu/personel başlığı (min sütun 120px), mobil üst çubuk tek satır (ad · SMS · ⋯ menü).

## Codex'e verilen işler (2026-11-16, PR #1 yorum 6932651050 / 6932659192)
- [x] T-100 | sahip: codex | Görsel kimlik ve "insancıl" tasarım (yalnız arayüz)
  - Pazarlama, rezervasyon ve yönetim ekranları için yeni görsel kimlik, TR/EN metinler ve mobil/masaüstü çekimleri.
- [x] T-101 | sahip: codex | Bağımsız kod incelemesi → docs/REVIEW.md
  - Sekiz bulgu, senaryo ve düzeltme önerisi raporlandı.
- [ ] T-102 | sahip: codex | İngilizce arayüz kontrolü ve düzeltmesi
- [ ] T-103 | sahip: codex | Lighthouse mobil > 85 (randevu sayfası)
- [ ] T-104 | sahip: codex | iCal dışa aktarma (personel başına gizli token)
- [ ] T-105 | sahip: codex | Google yorum isteği SMS'i (varsayılan kapalı)
- [ ] T-106 | sahip: codex | Panel PWA + yeni randevu bildirimi

## REVIEW.md T-101 bulgularından düzeltmeler (öncelik sırasıyla)
- [x] T-110 | sahip: codex | (Yüksek 1) Üretimde e-posta sağlayıcı yoksa sihirli bağlantıyı kapat; token/URL'yi loglardan çıkar (ilk açılış süper-admin şifre bağlantısı istisna, brief gereği) + log yakalayan test
- [x] T-111 | sahip: codex | (Yüksek 3) OTP: salon başına maliyet tavanı + yeniden gönderim bekleme süresi; kayıtlı/kayıtsız numarada aynı HTTP yanıtı
- [x] T-112 | sahip: codex | (Yüksek 2) Mesaj gönderiminde işçi kesintisi: askıda `queued` kayıtları uzlaştırma (süreli sahiplik + iade/yeniden deneme) + kesinti enjekte eden test
- [x] T-113 | sahip: codex | (Orta 4) OTP: salon+telefon başına tek kullanılmamış kod (kısıt/kilit) + paralel test
- [x] T-114 | sahip: codex | (Orta 5) Abonelik taraması ile ödeme yarışı: kilit altında yeniden okuma / koşullu güncelleme
- [x] T-115 | sahip: codex | (Orta 6) İptal kontrolünde okunan startsAt ile koşullu güncelleme
- [x] T-116 | sahip: codex | (Orta 7) Kampanya: kalıcı kampanya/alıcı kaydı, kredi rezervasyonu, yeniden denemede yalnız kalanlar
  - Kalıcı alıcı/içerik snapshot, zorunlu işlem anahtarı ve tenant kilitli kredi hold; güvenli kalanları worker sürdürür, belirsiz teslim yeniden gönderilmez. CI283/build ve gerçek tarayıcı kampanya testi geçti.
- [x] T-117 | sahip: codex | (Orta 8) Manuel ödemede idempotency anahtarı
  - Tenant+UUID, ilk sonuç snapshot, değişen içerikte409; kayıp yanıtta panel aynı niyeti sürdürür. Test/teslim: REVIEW.md.
- [x] T-118 | sahip: codex | Tenant kapsamı: desteklenmeyen işlemleri (ilişki mutasyonu, ham SQL vb.) withTenant'ta açıkça reddet
  - 19 Kasım: izin listesi/nested write/ham SQL ve parent escape reddi; User kapalı, sabit kilit yardımcıları. CI303/build ve altı e2e geçti.

## 18 Kasım teslim sırası
- [x] T-100R | sahip: codex | T-100 kalanı: sıcak salon varsayılanı ve yalnız klavyede adım odağı
  - Seed zeytin/kiremit, brandVars yedeği zeytin; özel salon/personel renkleri korundu. CI 227 test, build, booking/panel e2e ve 390/1280 odak kontrolleri geçti.
- [x] T-122 | sahip: codex | Video yuvası/poster yedeği ve mevcut tasarımda görsel cila (onaylı alternatif)
  - Claude6987735407 kararı: kodla sıcak SVG arka plan; gerçek stok klip + üç kare sahipten bekleniyor (TODO_INSAN). 390/1280 önce/sonra kanıtı, 7 Chromium medya senaryosu, booking/panel geçti; kart/uyarı/takvim cilası ve azaltılmış hareket uyumlu onay animasyonu eklendi.
- [x] T-119 | sahip: codex | Pino ortam doğrulamasında yöntem bağlamını koru

- 2026-11-18 T-110/T-119: üretimde mock e-posta ile magic-link üretim/tüketim kapalı; auth bağlantıları loglanmaz, yalnız bootstrap şifre bağlantısı istisna. Gerçek Pino regresyonlarında önce6 hata, sonra10/10 geçti; tam CI236, build ve flow/isolation gerçek HTTP kontrolleri geçti.

- 2026-11-18 T-111: salon kilidi altında kalıcı60sn bekleme ve UTCgünlük30segment konservatif rezervasyon tavanı; başarısız denemeler sayılır, kayıtlı/kayıtsız HTTP200 aynı. Migration uygulandı. Önce3 regresyon kırmızı, sonra yeni5+mevcut13 DBtesti yeşil; tamCI241/build ve dört e2e yeşil. T113benzersizkısıt ayrı kaldı.

## 18 Kasım — kullanıcının onayladığı ek ürün kapsamı
Önce mevcut güvenlik sırası T112→T113→T114→T115→T116→T117→T118; ardından T104/T105 ve aşağıdaki işler. Aynı özellik için ikinci uygulama açılmaz; mevcut ServiceStaff/panel taşıma kodu genişletilir. Ayrıntılar docs/PRODUCT_NEXT.md.
- [x] T-123 | sahip: codex | Claude6988228345: ana sayfa KVKK ifadesini KKTC için nötr kişisel veri ifadesine çevir (TR+EN); T112 teslimiyle
- [ ] T-124 | sahip: codex | Personel bazlı hizmet uygunluğu ve gerekiyorsa süre/fiyat farklarını mevcut rezervasyon motoruna bağla; fiyat snapshot, mesai/çakışma ve tenant testleri
- [ ] T-125 | sahip: codex | Bekleme listesi: açık rıza, süre sonu, iptal, boşluk için idempotent davet; rezervasyon önceliği iddiası yok, SMS mock
- [ ] T-126 | sahip: codex | Müşterinin güvenli bağlantıdan randevu taşıması: iptal/taşıma süresi kuralı, atomik çakışma kontrolü, hatırlatmaların yenilenmesi, paralel/izolasyon testleri
- [ ] T-127 | sahip: codex | Gerçek izinli berber videosu ve salon fotoğrafları; lisans/izin kaydı, mobil bütçe, hareket/veri tasarrufu; erişim/varlık yoksa açık eksik bırak
- [ ] T-128 | sahip: codex | KKTC kapora/online ödeme sağlayıcısı uygunluk araştırması; şirket/para birimi/hesap/iade/webhook/test ortamı doğrulanmadan adaptör veya gerçek tahsilat yok
- [ ] T-129 | sahip: codex | 2–3 salonla pilot kullanım için senaryo, ölçüm ve geribildirim planı hazırla; gerçek salon katılımı/iletişimi sahip tarafından sağlanır, sonuç uydurulmaz

- 2026-11-18 T112+T123: iki dakikalık sahiplik, ağ çağrısı öncesi işaret, tenant kilidi altında koşullu tek iade; başlangıç/dakikalık sınırlı uzlaştırma. Belirsiz teslim otomatik tekrarlanmaz. İlk4kesinti testi kırmızı; sonCI251/build yeşil, worker açılışı ve pg-boss dakika kaydı doğrulandı. TR/EN kişisel veri başlığı nötrleştirildi.

- 2026-11-18 T113: transaction içi yazma kilidi + deterministik eskiunused temizliği + salon/telefon partialuniqueindex. Önce paralelinsert2/2başarılı testi kırmızı; sonra üç kısıt/migration testi ve mevcut beşOTPbütçe testi yeşil. TamCI254/build, booking/flow/isolation e2e PASS.

- [x] T-130 | sahip: claude | Küçük arayüz düzeltmeleri (adım 4 hata gösterimi, e2e salon temizliği, takvim iskeleti, dile uyumlu tarih/ay seçici, ayarlar kaydet düzeni)
  - Admin salon detayı hatası yeniden üretilemedi (test zamanlaması).

## Güvenlik incelemesi 2 (docs/REVIEW-GUVENLIK-2.md) — öncelik sırasıyla
- [x] T-140 | sahip: codex | KRİTİK: next ≥15.5.x güvenli sürüm + next-auth ≥5.0.0-beta.32'ye yükselt (pnpm audit 8 kritik); tüm testler/e2e yeşil
- [x] T-141 | sahip: codex | YÜKSEK: middleware getToken secureCookie (HTTPS'te __Secure- çerezi) — yayın engelleyici; HTTPS senaryolu test
- [x] T-142 | sahip: codex | YÜKSEK: anonim rezervasyon SMS kötüye kullanımı — telefon/salon başına günlük onay SMS tavanı, yabancı numara politikası (ülke izin listesi ayarı), şüpheli desende SMS'siz onay
- [x] T-143 | sahip: codex | ORTA: safeNext TAB/kontrol karakteri açık yönlendirmesi
  - Kontrol/boşluk/ters slash reddi, URL origin kontrolü ve landingFor yeniden doğrulaması; CI321/build + safe-next/booking/panel/flow/isolation e2e geçti.
- [x] T-144 | sahip: codex | ORTA: anonim rezervasyon mevcut müşterinin ad/e-posta/pazarlama iznini ezmesin; izin geri çekme (opt-out) yolu
  - Anonim müşteri kaydı değişmez/izin açılmaz; OTP bağlı tercih, owner opt-out, audit+legacy reset ve claim/dispatch yarışı koruması. CI329/build + yedi e2e geçti.
- [ ] T-145 | sahip: codex | ORTA: giriş kilidi yalnız başarısız denemeleri saysın (DoS önleme)
- [ ] T-146 | sahip: codex | ORTA: güvenilir proxy IP'si (TRUST_PROXY), OTP zamanlama eşitleme, salon OTP kotasının tek müşteriyi kilitlememesi, JWT iptali (sürüm/tokenVersion), Caddy HSTS+CSP+gövde sınırı, erişim logunda token maskeleme
- [ ] T-147 | sahip: codex | DÜŞÜK: personel müşteri araması joker kaçışı, NUL bayt/bozuk Bearer 500'leri, gövde boyut sınırı, .env.example SUPERADMIN_EMAIL, yedek dosya izinleri 0600, SMS başlığı doğrulaması

- T114 (18Kasım): ödemeyle aynı tenant kilidi altında yeniden okuma; durum ve uyarı/audit aynı transaction. Yeni ortamda önce2regresyonFAIL, sonra tamCI257/build+panel/flow/isolationPASS. Luna karşılıklı inceleme, önemli hata yok.

- T140: Next15.5.29/Authbeta32+transitivepatchler, Zod4 uyumu. Prod audit önce8kritik20yüksek→sonra0tümseviyeler. CI257/build geçti; ayrıntı SECURITY-DEPENDENCIES.md ve PRtestsonuçları.

- T141: secureCookie istekşemasından seçilir. GerçekAuth.js şifreliçerez regresyonu önce2FAIL/1PASS→3PASS; CI260/build+HTTPpanel/flow/isolationPASS. YerelgerçekTLSproxy+Chromium giriş, Secure/HttpOnlyçerez, panelreload, owner/admin veanonimsınırlarPASS.

- 19Kasım T142: tümrandevu+OTP SMSlerinde ülkeizinlistesi/segmentkotası; varsayılan90, salon200/gün(owner1–2000), telefonplatformgeneli6/gün, UTC. İlk4regresyon ve panelatlama testi önceFAIL; yeni7DBtesti, CI267/build+dört e2ePASS. Yabancıbooking açık, blockednofallback/nodebit; ayarlarUI→API→DB→reloadPASS. SMS-POLICY.md.

- 19Kasım T115: okunan startsAt+iptalkuralı+tenant+token+openstatus koşullugüncelleme; aradadeğişirse409/UIyenileme, kapalı/missing ayrımıkorunur. Saatyarışları önce2FAIL/1PASS, ayrıpolicytesti1FAIL/3PASS; son4DBtesti/CI271/build+booking/flow/isolationPASS.
- [x] T-150 | sahip: codex | Hizmetekleme personelverisi yüklenmeden açılmasın (flow e2e bulgusu)
  - İlkflow0personelbağıFAIL, staffAPIgate ileAdddisabled regresyonuFAIL; loaderhazırolana dekbuttondisabled. Soncontrolledflowpersonelbağı1PASS; CI271/build ve diğer ilgili e2elerPASS.
