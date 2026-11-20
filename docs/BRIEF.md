# KıbrısRandevu — ürün belgesi (sahibin brief'inin özeti; tüm gereksinimler korunmuştur)

## 0. Çalışma kuralları
1. Durma, soru sorma; belirsizlikte makul varsayım + `docs/DECISIONS.md` satırı.
2. Tek repo; küçük Türkçe commit'ler (`feat: …`, `fix: …`).
3. Görev panosu `docs/TASKS.md`: `- [ ] T-012 | sahip: - | …`; başlamadan sahip yaz ve commit et; başkasının görevine dokunma; bitince `[x]` + 1 satır not.
4. İş bölümü: Claude = mimari, veri modeli, backend/API, iş kuralları (müsaitlik, SMS defteri, abonelik), güvenlik. Codex = arayüz (salon paneli, müşteri sayfası, süper-admin), testler (birim+e2e), CI, Docker/deploy, seed. Boşta kalan sahipsiz en üst görevi alır.
5. 30–45 dk'da bir karşılıklı inceleme → `docs/REVIEW.md` + `fix` görevi; sessizce yeniden yazma yok.
6. `docs/PROGRESS.md` saat başı 3–5 satır.
7. Aynı hatada 3 denemeden sonra daha basit yol + DECISIONS. Eksik hesap/anahtar → mock + `docs/TODO_INSAN.md`.
8. Gizli bilgi repoya girmez; yalnız `.env.example`.
9. `SMS_PROVIDER=mock` varsayılan; gerçek gönderim yalnız gerçek sağlayıcı + `ALLOW_REAL_SMS=true`.
10. Commit öncesi `pnpm lint && pnpm typecheck && pnpm test`.

## 1. Ürün
- Ad: KıbrısRandevu (`config/brand.ts`). Pazar: KKTC (Lefkoşa, Girne, Gazimağusa, Güzelyurt, İskele); berber/kuaför/güzellik/tırnak/kirpik; son kullanıcı yerel + öğrenci + İngilizce konuşan yabancı.
- Planlar (`config/plans.ts`, TL, admin değiştirebilir, 14 gün deneme): Başlangıç 750 (1 personel, online sayfa, sınırsız randevu, 100 SMS/ay); Pro 1.250 (5 personel, raporlar, müşteri notları, 300 SMS); Salon+ 2.000 (sınırsız personel, çoklu şube, WhatsApp hatırlatma, kampanya SMS).
- SMS paketleri 500/1.000/5.000; kredi bitince e-posta/WhatsApp'a düş + salona uyarı.
- Ödeme MVP'de manuel (süper-admin işaretler); `PaymentProvider` arayüzü (iyzico/PayTR ileride).
- Diller TR (varsayılan) + EN, dil seçici, tüm metinler i18n. TL; salon bazında saat dilimi.
- Telefon: libphonenumber-js, E.164; KKTC +90 533/542/548/539…, TR, UK, yabancı; varsayılan TR.

## 2. Yığın
Next.js App Router + TS strict; PostgreSQL 16 + Prisma; Auth.js (e-posta+şifre bcrypt/argon2, sihirli bağlantı; müşteri hesapsız, OTP ile yönetim); Tailwind + shadcn/ui, mobil öncelikli; pg-boss; Vitest + Playwright; pnpm; Docker Compose (app+postgres+caddy, `APP_DOMAIN` yoksa localhost/IP); pino, `/api/health`.
Repo yapısı: `app/(public)/[salonSlug]`, `app/(panel)/panel`, `app/(admin)/admin`, `app/api`, `lib/`, `prisma/`, `jobs/`, `config/`, `tests/`, `docs/`, `docker-compose.yml`, `Caddyfile`, `.env.example`.

## 3. Veri modeli
Tenant, User (owner/staff/superadmin), Staff, Service (tr/en ad, süre, fiyat, tampon, personel çoka-çok), WorkingHours (+molalar), TimeOff, Customer (E.164, marketingConsent+tarih, gelmedi sayısı), Appointment (pending/confirmed/cancelled_by_customer/cancelled_by_salon/completed/no_show; online/panel/walk_in; iptal token), SmsLedger (bakiye defterden), MessageLog, Invoice/Payment, AuditLog. Tüm tenant sorguları `tenantId` ile; merkezi `withTenant()`; e2e izolasyon testi şart.

## 4. Kilometre taşları
- M1 İskelet: compose ile ayağa kalkar, `/api/health` 200; seed 2 salon ("Lefkoşa Usta Berber", "Girne Glow Kuaför") × 3 personel, 6 hizmet, 30 randevu; `pnpm ci`.
- M2 Müşteri akışı: hizmet → personel ("fark etmez") → tarih/saat → ad+telefon → onay; `lib/availability.ts` (çalışma saati, mola, izin, randevular, süre+tampon, en erken/en geç, 15 dk slot) + kapsamlı testler; DB seviyesinde çift rezervasyon engeli; onay SMS'i, `/r/{token}` iptal (X saat kuralı); OTP "Randevularım"; aydınlatma linki + işaretsiz pazarlama izni.
- M3 Salon paneli: kayıt sihirbazı + 14 gün deneme; günlük/haftalık takvim (personel sütunları, sürükle-bırak, panelden ekleme, gelmedi); hizmet/personel/çalışma saati/izin; müşteri listesi; ayarlar (SMS başlığı, hatırlatma 24s/2s, iptal kuralı, görünüm); SMS bakiye kartı + paket talebi; basit rapor.
- M4 Bildirimler: `MessageProvider` (Mock varsayılan, Netgsm, İletiMerkezi, GenericHttpSms, WhatsAppCloud); tr/en şablonlar (onay, 24s, 2s, iptal, değişiklik); segment bazlı kredi düşümü; pg-boss zamanlama, değişince/iptalde iş iptali, idempotency; 22:00–08:00 pazarlama yok; kampanya yalnız izinli müşteriye + çıkış ifadesi.
- M5 Süper-admin: salon listesi; manuel ödeme → abonelik uzatma; SMS paketi → defter; deneme bitişine 3 gün kala + bitince uyarı; 7 gün past_due → suspended (sayfa "geçici kapalı", veri silinmez); MRR, aktif salon, satılan SMS; AuditLog.
- M6 Pazarlama sitesi: `/` TR+EN, özellikler, fiyatlar (config), SSS, CTA, WhatsApp butonu; salon sayfaları SEO (OG, LocalBusiness JSON-LD); gizlilik/kullanım şablonları.
- M7 (ops., `AI_API_KEY` varsa): kampanya önerisi, gelmeme riski skoru; anahtarsız gizli.

## 5. Güvenlik/kalite
Zod (istemci+sunucu); rate limit (OTP 5/saat/telefon, giriş, randevu/IP); OTP hash'li 5 dk; CSRF, güvenli çerez, güvenlik başlıkları; tenant izolasyon testi (başka salon ID → 404); günlük pg_dump 14 gün + RUNBOOK geri yükleme; erişilebilirlik; Lighthouse mobil > 85.

## 6. Deploy
`docker compose up -d --build`; Caddy (`APP_DOMAIN` → HTTPS, yoksa :80); ilk açılışta migration (üretimde demo seed yasak; `SEED_DEMO=true` başlangıcı durdurur); `SUPERADMIN_EMAIL` ile süper-admin, şifre bağlantısı loga; RUNBOOK (başlatma, güncelleme, yedek, log, SMS sağlayıcı değiştirme).

## 7. MVP bitti tanımı
10 dk'da salon yayında; 4 adımda randevu, çift rezervasyon imkânsız; mesajlar mock'ta doğru zaman/tek sefer/doğru kredi; panel ekranları; süper-admin ödeme+kredi; TR/EN tam; testler yeşil + e2e (kayıt → hizmet → randevu → hatırlatma kuyrukta → iptal); `docker compose up` + RUNBOOK. → PROGRESS'e "MVP TAMAM".

## 8. İyileştirme sırası
Uç durum avı; PWA + bildirim; iCal dışa aktarma; Google yorum SMS'i; çoklu şube; iyzico/PayTR test modu; performans/cila.
