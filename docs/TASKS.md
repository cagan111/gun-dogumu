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
- [ ] T-006 | sahip: codex | Seed: 2 salon × 3 personel, 6 hizmet, 30 randevu (`SEED_DEMO`)
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
- [ ] T-017 | sahip: codex | `/[salonSlug]` 4 adımlı randevu arayüzü (mobil, klavye erişilebilir)
- [ ] T-018 | sahip: codex | Onay ekranı, `/r/{token}` iptal sayfası, Randevularım sayfası
- [ ] T-019 | sahip: codex | Aydınlatma metni linki + işaretsiz pazarlama izni kutusu
- [ ] T-020 | sahip: claude | i18n altyapısı (tr/en sözlükleri, dil seçimi)

## M3 – Salon paneli
- [x] T-030 | sahip: claude | Auth.js: e-posta+şifre, sihirli bağlantı, rol/tenant oturumu, rate limit
  - `auth.ts` (Credentials + magic-link sağlayıcısı, JWT userId/role/tenantId), `lib/session.ts`, `middleware.ts`, `LoginToken` migration'ı; sihirli bağlantı e-posta yerine loga.
- [x] T-031 | sahip: claude | Kayıt + salon oluşturma API'si (slug benzersizliği, 14 gün deneme)
  - `POST /api/auth/signup`, `GET /api/auth/slug-check`; tenant+owner+SMS kredisi tek transaction'da, çakışmada 409.
- [ ] T-032 | sahip: codex | Kayıt sihirbazı arayüzü (ad, şehir, slug, saatler, ilk hizmetler)
- [x] T-033 | sahip: claude | Panel API: randevu listele/ekle/taşı/durum (gelmedi), tenant korumalı
  - `app/api/panel/appointments` (GET liste, POST ekle, `[id]` GET/PATCH taşı, `[id]/status`); servis `lib/panel/appointments.ts`, panelden `bypassLeadRules` (çakışma/mesai asla atlanmaz), gelmedi sayacı atomik.
- [ ] T-034 | sahip: codex | Takvim (günlük/haftalık, personel sütunları, sürükle-bırak)
- [x] T-035 | sahip: claude | Panel API: hizmet, personel, çalışma saati, izin CRUD
  - `/api/panel/{services,staff,time-off}` + `staff/[id]/working-hours` (PUT); yazma yalnız owner (`assertOwner`, servis katmanında), plan `maxStaff` → 402 `plan_limit`; servis `lib/panel/catalog.ts`, mola doğrulama `lib/hours.ts`.
- [ ] T-036 | sahip: codex | Hizmet/personel/saat/izin ekranları
- [x] T-037 | sahip: claude | Müşteri API: arama, geçmiş, not, gelmedi sayısı
  - `GET /api/panel/customers` (q, sayfalı), `GET/PATCH /api/panel/customers/[id]` (notlar Pro+, Başlangıç → 402 `plan_feature`); `lib/panel/customers.ts`.
- [ ] T-038 | sahip: codex | Müşteri listesi ekranı
- [x] T-039 | sahip: claude | Ayarlar API (SMS başlığı, hatırlatma zamanları, iptal kuralı, görünüm)
  - `/api/panel/settings` (GET/PATCH owner), `/api/panel/sms/{requests,balance}`; bakiye kanonik `lib/ledger.ts` (tenant satırı FOR UPDATE; eşzamanlı düşüm testi); `lib/panel/settings.ts`.
- [ ] T-040 | sahip: codex | Ayarlar ekranı + SMS bakiye kartı + paket talep butonu
- [x] T-041 | sahip: claude | Rapor API (randevu sayısı, ciro tahmini, en çok hizmet/personel, gelmeme oranı)
  - `GET /api/panel/reports?month=YYYY-MM` (Pro+); `lib/panel/reports.ts` (salon saat dilimiyle ay, ciro = completed + geçmiş confirmed).
- [ ] T-042 | sahip: codex | Rapor ekranı

## M4 – Bildirimler
- [ ] T-050 | sahip: claude | `lib/messaging` MessageProvider + Mock + Netgsm + İletiMerkezi + GenericHttp + WhatsAppCloud
- [ ] T-051 | sahip: claude | SMS segment hesabı (GSM-7 / Türkçe tek-kaydırma / UCS-2) + testler
- [ ] T-052 | sahip: claude | SmsLedger: bakiye, düşüm, iade, aylık plan kredisi + testler
- [ ] T-053 | sahip: claude | Şablonlar tr/en (onay, 24s, 2s, iptal, değişiklik)
- [ ] T-054 | sahip: claude | pg-boss işleri: hatırlatma zamanlama/iptal, idempotency, sessiz saatler
- [ ] T-055 | sahip: claude | Kredi bitince e-posta/WhatsApp'a düşme + salona uyarı
- [ ] T-056 | sahip: claude | Kampanya SMS'i (Salon+, yalnız izinli, çıkış ifadesi)

## M5 – Süper-admin ve gelir
- [x] T-060 | sahip: claude | Süper-admin API: salonlar, manuel ödeme → abonelik uzatma, SMS paketi → defter, AuditLog
  - `/api/admin/{tenants,tenants/[id],…/plan,…/suspend,…/unsuspend,payments,sms-credits,sms-requests,sms-requests/[id],plan-prices,revenue,audit}`; `lib/admin/service.ts`, `lib/billing/payments.ts`; her mutasyon AuditLog (actorId).
- [ ] T-061 | sahip: codex | `/admin` ekranları (liste, ödeme, kredi, audit)
- [x] T-062 | sahip: claude | Abonelik durum makinesi (trial → active → past_due 7 gün → suspended) + uyarı işleri
  - `lib/billing/subscription.ts` `nextStatus` (saf) + `applySubscriptionTick` (AuditLog + tekrarsız uyarı listesi); zamanlanmış çağrı T-054/pg-boss işinde yapılacak.
- [x] T-063 | sahip: claude | Gelir özeti (MRR, aktif salon, satılan SMS)
  - `GET /api/admin/revenue` (`revenueSummary`: MRR güncel plan fiyatlarıyla, durum sayıları, bu ay satılan SMS) + `PATCH /api/admin/plan-prices`, `getPlanPrice()` (`lib/plan-price.ts`).
- [x] T-064 | sahip: claude | `PaymentProvider` arayüzü + `manual`
  - `lib/billing/payment-provider.ts`: `PaymentProvider`, `ManualPaymentProvider`, iyzico/PayTR `not_configured` taslakları.
- [x] T-065 | sahip: claude | İlk açılışta SUPERADMIN_EMAIL hesabı + şifre bağlantısı loga
  - `lib/bootstrap.ts` `ensureSuperadmin()` (`instrumentation.ts`'ten), `POST /api/auth/set-password`; bağlantı pino warn ile loga.

## M6 – Pazarlama ve SEO
- [ ] T-070 | sahip: codex | `/` ana sayfa TR/EN (özellikler, fiyatlar, SSS, CTA, WhatsApp)
- [ ] T-071 | sahip: codex | Salon sayfası SEO (meta, OG, LocalBusiness JSON-LD)
- [ ] T-072 | sahip: codex | Gizlilik + kullanım koşulları şablon sayfaları

## Güvenlik ve kalite
- [x] T-080 | sahip: claude | Rate limit yardımcısı (bellek/DB) + güvenlik başlıkları + CSRF
  - `lib/ratelimit.ts` (arayüz + bellek uygulaması, `setRateLimiter`), `lib/http.ts` (hata→HTTP, Zod 400, IP); güvenlik başlıkları zaten `next.config.mjs`'te; CSRF: oturum çerezi SameSite=Lax + JSON API, ayrı token yok.
- [ ] T-081 | sahip: codex | e2e tenant izolasyon testi (başka salon ID → 404)
- [ ] T-082 | sahip: codex | e2e: kayıt → hizmet → randevu → hatırlatma kuyrukta → iptal
- [ ] T-083 | sahip: codex | Günlük pg_dump yedeği (14 gün) + RUNBOOK geri yükleme
- [ ] T-084 | sahip: claude | `docs/RUNBOOK.md` (başlatma, güncelleme, log, SMS sağlayıcı değiştirme)
- [ ] T-085 | sahip: codex | Lighthouse mobil ölçümü (randevu sayfası > 85)

## Ek (inceleme sonrası)
- [ ] T-090 | sahip: claude | Askıya alınmış (suspended) salonda panel yazma işlemlerini engelle (okuma serbest)
- [ ] T-091 | sahip: claude | Panel değişikliklerini (hizmet, ayar, personel) AuditLog'a yaz
- [ ] T-092 | sahip: claude | Ödeme/ay yenilemede planın aylık SMS kredisini deftere ekle (T-052 ile)
