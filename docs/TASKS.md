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
- [ ] T-007 | sahip: codex | Dockerfile + docker-compose (app, postgres, caddy, yedek) + Caddyfile
- [ ] T-008 | sahip: codex | GitHub Actions CI (lint, typecheck, test, Postgres servisli)

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
- [ ] T-061 | sahip: claude | `/admin` ekranları (liste, ödeme, kredi, audit)
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
- [ ] T-081 | sahip: codex | e2e tenant izolasyon testi (başka salon ID → 404)
- [ ] T-082 | sahip: codex | e2e: kayıt → hizmet → randevu → hatırlatma kuyrukta → iptal
- [ ] T-083 | sahip: codex | Günlük pg_dump yedeği (14 gün) + RUNBOOK geri yükleme
- [ ] T-084 | sahip: claude | `docs/RUNBOOK.md` (başlatma, güncelleme, log, SMS sağlayıcı değiştirme)
- [ ] T-085 | sahip: codex | Lighthouse mobil ölçümü (randevu sayfası > 85)

## Ek (inceleme sonrası)
- [x] T-090 | sahip: claude | Askıya alınmış (suspended) salonda panel yazma işlemlerini engelle (okuma serbest)
  - `ctx.tenantStatus` + `assertWritable` (servis katmanı) ve `panelRoute` yazma yöntemlerinde 423 `suspended`; okuma serbest.
- [x] T-091 | sahip: claude | Panel değişikliklerini (hizmet, ayar, personel) AuditLog'a yaz
  - `lib/panel/audit.ts` `auditPanel`: hizmet/personel/saat/izin/ayar/kampanya AuditLog (actorId = kullanıcı).
- [x] T-092 | sahip: claude | Ödeme/ay yenilemede planın aylık SMS kredisini deftere ekle (T-052 ile)
  - T-052 ile birlikte: `grantMonthlyCreditsFor` ödeme sonrası ve günlük işte; aynı ay ikinci kez verilmez.
