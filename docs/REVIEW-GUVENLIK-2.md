# KıbrısRandevu — Güvenlik + Backend İnceleme Raporu

Tarih: 18 Kasım 2026. Kod: `/home/user/kr-r` (HEAD `6d9930b`). Canlı hedef: `http://localhost:3400` (üretim build, yerel Postgres, mock SMS).
Yöntem: kod okuma + gerçek HTTP istekleri (Node fetch/curl, betikler bu klasörde: `t1..t13.mjs`, `lib.mjs`). Repo dosyalarına dokunulmadı.
`docs/REVIEW.md` T-101 bulguları ve T-114…T-118 tekrar raporlanmadı (aşağıda yalnız "daha kötü çıkan" olan not edildi).

Etiketler: **[DOĞRULANDI]** canlı istekle/komutla gösterildi, **[KOD]** yalnız kod okumasıyla, **[VARSAYIM]** doğrulanamadı.

## Özet tablo

| # | Önem | Başlık |
|---|---|---|
| 1 | Kritik | Next.js 15.1.6 / next-auth beta.25: onlarca bilinen zafiyet (RCE dahil) |
| 2 | Yüksek | HTTPS'te middleware oturumu tanımıyor → `/panel` ve `/admin` açılmıyor (yayın engelleyici) |
| 3 | Yüksek | Doğrulamasız anonim rezervasyon: üçüncü kişiye SMS, uluslararası numara (SMS pumping), kredi tüketimi |
| 4 | Orta | Açık yönlendirme: `?next=/%09/evil.com` |
| 5 | Orta | Başkasının müşteri kaydını (ad, e-posta, pazarlama izni) anonim ezme; izin geri alınamıyor |
| 6 | Orta | E-posta başına giriş kilidiyle hesap kilitleme (DoS) |
| 7 | Orta | Rate limit istemci IP'sini `X-Forwarded-For` ilk değerinden alıyor (proxy'ye bağımlı) |
| 8 | Orta | OTP: zamanlama oracle'ı + tek salon günlük kotası tüm müşterileri kilitler |
| 9 | Orta | JWT sunucu tarafında iptal edilemiyor (çıkış/şifre değişimi sonrası 7 gün geçerli) |
| 10 | Orta | Caddy: HSTS/CSP yok, erişim logunda token'lı URL'ler, gövde boyut sınırı yok |
| 11 | Düşük | Staff, "müşteri listeleme yok" kararını `%%%` joker ve takvimle aşıyor |
| 12 | Düşük | NUL bayt → 500 (herkese açık uçlar dahil) |
| 13 | Düşük | Gövde boyutu sınırsız (30 MB kabul edildi) |
| 14 | Düşük | Malformed `Authorization: Bearer` → middleware 500 |
| 15 | Düşük | Üretimde bootstrap/seed riskleri (`admin@example.com`, SEED_DEMO, `e2e-` silme) |
| 16 | Düşük | Parola politikası, gizli anahtar kalitesi, anahtar ayrımı, 2FA yok |
| 17 | Düşük | SMS gönderen adı (alfanümerik) tenant tarafından serbest |
| 18 | Düşük | Yedek dosyaları ana makinede 0644 (varsayılan umask) |
| 19 | Bilgi | Diğer notlar |

---

## KRİTİK

### 1. Bağımlılıklar: Next.js 15.1.6 ve next-auth 5.0.0-beta.25 [DOĞRULANDI: `pnpm audit --prod`]
`package.json:23-24` (`next 15.1.6`, `next-auth 5.0.0-beta.25`), `@auth/core 0.37.2`. `pnpm audit --prod` → **53 zafiyet: 8 kritik, 20 yüksek, 22 orta, 3 düşük**. Ham çıktı: `audit.json`.
Öne çıkanlar (düzeltilmiş sürüm):
- next: React flight protokolünde RCE (GHSA-9qr9-h5gf-34mp, ≥15.1.9); Middleware yetki atlatma (GHSA-f82v-jwr5-mffw, ≥15.2.3); görüntü optimizasyonunda RCE (AVIF/SVG, GHSA-2xp9-vwfh-vxw4 / GHSA-2464-fhr4-w9xw, ≥15.5.28); çok sayıda RSC/Server Actions DoS, SSRF, önbellek zehirleme (≥15.5.16–15.5.28). Tümünü kapatan en düşük sürüm: **next ≥ 15.5.28** (veya güncel 15.5.x).
- next-auth/@auth/core: "yapılandırma hatasında varlık-tabanlı auth kontrolü açık kalır" (kritik, ≥beta.32 / core ≥0.41.3), e-posta normalizer atlatma, `getToken()` bozuk Bearer'da istisna (aşağıda #14), OAuth state çerezleri (bu projede OAuth yok).
- sharp (next üzerinden), postcss, zod 3.24.1 (`<4.6.6`: sınırlı koleksiyonlarda bellek tüketimi; yalnız v4'te düzeltilmiş).
Canlı kanıt (zafiyet sömürülmedi): Middleware atlatma başlığı bu build'de `/panel`'i açmıyor çünkü `app/panel/layout.tsx:12-14` ve `app/admin/layout.tsx:10` ayrıca `auth()` kontrolü yapıyor (307 döndü), API'ler de oturumu DB'den doğruluyor. Yani "yetki atlatma" derinlikte tutuluyor; ancak RCE/DoS sınıfı zafiyetler uygulama mantığından bağımsızdır.
Etki: İnternete açık Next 15.1.x'te kimlik doğrulamasız RCE/DoS. Düzeltme: next ≥15.5.28 (+ react/react-dom eşleşen sürüm), next-auth ≥5.0.0-beta.32 (@auth/core ≥0.41.3), `pnpm audit --prod` CI adımı (CI şu an audit çalıştırmıyor). Yükseltme sonrası #2'yi mutlaka yeniden sına (davranış değişebilir).

---

## YÜKSEK

### 2. HTTPS üretiminde middleware oturum çerezini görmüyor → panel/admin erişilemez [DOĞRULANDI]
`middleware.ts:8`: `getToken({ req, secret })` — `secureCookie` verilmiyor. `@auth/core@0.37.2/jwt.js:85` varsayılanı `secureCookie ?? false` ⇒ çerez adı `authjs.session-token` aranır. Oysa `NEXTAUTH_URL=https://…` iken Auth.js `__Secure-authjs.session-token` yazar.
Tekrar: aynı build ile `NEXTAUTH_URL=https://randevu.example.test AUTH_TRUST_HOST=true next start -p 3401`; giriş (`/api/auth/callback/credentials`) 302 + `__Secure-authjs.session-token` (Secure, HttpOnly, SameSite=Lax) → ardından `GET /panel` (çerezle) → **307 `/giris?next=%2Fpanel`**; aynı çerezle `GET /api/panel/services` → 200. (Yerel HTTP'de çalıştığı için e2e'de görünmemiş.)
Etki: Docker/Caddy + `APP_DOMAIN` (HTTPS) kurulumunda giriş döngüsü; ürün üretimde kullanılamaz. Güvenlik açısından fail-closed (kimse içeri girmez) ama yayın engelleyici.
Düzeltme: `getToken({ req, secret, secureCookie: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https" })` (salt/cookieName buna göre otomatik); veya middleware'de `auth()` kullan. HTTPS'li bir staging ile e2e ekle.

### 3. Doğrulamasız anonim rezervasyon: SMS bombalama, SMS pumping, kredi tüketimi [DOĞRULANDI]
`lib/public.ts:123-140`, `lib/booking.ts:42,147-156`, `lib/phone.ts:7-15`, `app/api/public/[slug]/appointments/route.ts:11`.
- Telefon sahipliği doğrulanmıyor (OTP yalnız `/randevularim` için). Rezervasyon başına 1 onay + her hatırlatma ofseti (varsayılan 2) SMS'i kurbanın numarasına gider (iş kuyruğa düştü: 6 rezervasyonumdan `send-confirmation`/`send-reminder` işleri oluştu).
- `normalizePhone` **her ülkenin** geçerli numarasını kabul ediyor: `+442071838750`, `+4915112345678`, `+8613812345678` ile 3 rezervasyon 201 döndü [DOĞRULANDI]. Gerçek sağlayıcıda uluslararası/premium numaralara SMS (SMS pumping/IRSF) maliyeti salona yansır.
- Kayıtlı salon sahibi (trial, ücretsiz kayıt) salon adı/hizmet adını kendisi belirlediği için bu SMS'ler üçüncü kişilere yönelik spam/oltalama taşıyıcısı olur (metin: `{salon}: … {service} …`, içinde bizim iptal bağlantımız).
- Sınırlar yalnız IP başına 10/saat (`:11`) — telefon başına, salon başına, bekleyen randevu sayısı başına tavan yok. Aynı numaraya, farklı slotlara art arda rezervasyon serbest [DOĞRULANDI: aynı telefonla 2 rezervasyon]. Takvimi sahte randevularla doldurmak da mümkün (iş etkisi).
Düzeltme: (a) varsayılan ülke kümesi (TR/CY +90 392/533…) dışını reddet ya da salon ayarına bağla; (b) telefon başına ve salon başına saatlik/günlük rezervasyon tavanı + telefon başına açık gelecek randevu sınırı; (c) ilk rezervasyonda OTP veya en azından yeni (müşteri kaydı olmayan) numara için doğrulama; (d) SMS göndermeden önce telefon başına günlük mesaj tavanı.

---

## ORTA

### 4. Açık yönlendirme (open redirect) [DOĞRULANDI]
`lib/safe-next.ts:4` yalnız `//` ve `\` filtreliyor; sekme/satırsonu içeren `/\t/evil.com` geçiyor. `app/giris/login-forms.tsx:36` (`landingFor` → `window.location.assign(next)`, satır 11): tarayıcı URL'deki TAB/LF'yi siler → `//evil.com`.
Tekrar: `GET /giris?next=%2F%09%2Fevil.com` → sayfa HTML'inde `next":"/\t/evil.com"`; `new URL("/\t/evil.com","http://x").href === "http://evil.com/"` (Node'da doğrulandı). Giriş sonrası kullanıcı evil.com'a gider (oltalama).
Düzeltme: `safeNext` içinde `/^\/(?![\/\\])[^\s\u0000-\u001f]*$/` benzeri; ya da `new URL(s, origin).origin === origin` doğrula ve yalnız `pathname+search` kullan. `landingFor`'da da aynı doğrulama.

### 5. Anonim rezervasyon mevcut müşteri kaydını eziyor; pazarlama izni geri alınamıyor [DOĞRULANDI]
`lib/booking.ts:152`: upsert `update` dalı ad/e-posta/izni, telefon kimin olursa olsun, değiştirir. Deneme: `+905339990001` için "Sec Test"/`victim@x.test`/`marketingConsent:true` ile ilk kayıt, sonra aynı numarayla "Attacker Renamed" → müşteri adı değişti, e-posta ve `marketingConsent=true` kaldı (panelden doğrulandı).
Etkiler: (i) rıza sahteciliği: kurban adına "pazarlama izni" üretilir → `lib/messaging/campaign.ts:33` o numaraya kampanya SMS'i gönderir (KVKK/ETK uyum riski); (ii) panelde müşteri adı/e-posta kirletme; (iii) `update` dalı yalnız izni `true` yapıyor (`:152`), izin hiçbir yerden `false` yapılamıyor (müşteri akışı, panel `PATCH /customers/[id]` yalnız `notes`). Kampanya alt bilgisi "İptal için: {telefon}" — teknik bir çıkış yok.
Düzeltme: mevcut müşteri için ad/e-posta/izin güncellemesini yalnız OTP'li oturumla veya yalnız boşsa doldurma; izin değişikliğini (açma/kapama) kayıtlı log ve doğrulanmış kanalla yap; panelde ve `/randevularim`'da izni kapatma ekle.

### 6. Hesap kilitleme (login DoS) [DOĞRULANDI]
`lib/login.ts:33-39`: e-posta başına 8/15dk sayacı **şifre doğrulamasından önce** ve saldırgan denemeleri de sayılarak işleniyor. Test: test kullanıcısına 9 farklı IP'den yanlış şifre → doğru şifreyle giriş artık oturum vermedi (kilitli). Herhangi bir sahibin e-postasını bilen biri sürekli kilitleyebilir (15 dk kayan pencere).
Düzeltme: sayacı yalnız başarısız denemelerde artır, e-posta+IP çifti için ayrı tut (tek başına e-posta kilidi yerine artan gecikme), başarılı girişte sıfırla; kalıcı depoda (DB) tut. Rate limit bellek içi olduğu için süreç yeniden başlayınca da sıfırlanır (`lib/ratelimit.ts`; çok örnekli kurulumda paylaşılmaz).

### 7. İstemci IP'si `X-Forwarded-For` ilk değerinden [DOĞRULANDI + KOD]
`lib/http.ts:96-100`. Uygulama doğrudan erişilebiliyorsa (test: `:3400`) her istekte `X-Forwarded-For: 10.77.1.N` değiştirerek tüm IP-tabanlı sınırlar (rezervasyon 10/saat, OTP 20/saat, kayıt 5/saat, giriş 30/15dk, set-password) aşılıyor: aynı XFF ile 11. istek 429, 12 farklı XFF ile 12/12 geçti. Aşırı farklı anahtar bellek haritasını da şişirir (`ratelimit.ts` sweep 60 sn).
Caddy önünde (`Caddyfile`, varsayılan `trusted_proxies` yok) Caddy gelen XFF'yi yok sayıp gerçek IP'yi yazar → docker-compose kurulumunda güvenli [KOD, canlı doğrulanmadı]; ama uygulama portu bir yük dengeleyici/CDN arkasına alınırsa ya da `app:3000` herhangi bir ağdan erişilirse bozulur. Düzeltme: güvenilir proxy sayısı ayarı (sağdan N. değer), ya da yalnız Caddy'nin set ettiği başlık (`X-Real-IP`, Caddy'de `header_up X-Real-IP {remote_host}` + XFF'yi istemciden alma).

### 8. OTP: zamanlama oracle'ı ve ortak günlük kota DoS'u
- **Zamanlama [DOĞRULANDI]** `lib/otp.ts:92-96`: kayıtlı numara ~63–118 ms, kayıtsız numara ~10–15 ms (aynı 200 `{sent:true}`). Müşteri varlığı sızıyor. T-101 #3'ün "HTTP davranışı eşit" düzeltmesi zamanı kapsamıyor. Düzeltme: sahte iş (gecikme/aynı yol) veya gönderimi arka plana al.
- **Ortak kota DoS [KOD]** `lib/otp.ts:19,108`: salon başına UTC günü 30 segment. Bilinen 30 kayıtlı telefon (veya aynı telefonla tekrar; bekleme 60 sn, saatlik 5 sınırı farklı telefonlarla aşılır) ile salonun tüm müşterilerinin OTP'si günün geri kalanında kapanır ve 30 kredi yakılır. Ayrıca bir telefona yeni OTP isteyen, kurbanın o an bekleyen kodunu geçersiz kılar (`:113`). Düzeltme: kotayı telefon/IP/salon üçlü kademeye böl, salon kotası dolunca yalnızca yeni numaralara değil doğrulanmış cihaz çerezine öncelik tanı.
- Olumlu: 6 haneli kod, 5 deneme/kod, saatlik 5 istek ⇒ kaba kuvvet ~1,2·10⁻⁴/gün/telefon; çerez imzalı, salona bağlı (başka slug'da 401 [DOĞRULANDI]).

### 9. JWT oturumu sunucuda iptal edilemiyor [KOD]
`auth.ts:12` JWT 7 gün; çıkış/şifre değişimi (`app/api/auth/set-password/route.ts:19` mevcut oturumları düşürmüyor)/rol değişimi sonrası çalınan çerez geçerli kalır. Kısmi hafifletme: API'ler her istekte kullanıcıyı DB'den doğruluyor (`lib/session.ts:15-24`: silinmiş/rolü değişmiş reddedilir) — fakat sayfa kabukları (`app/admin/layout.tsx:10`, panel layout) yalnız JWT'ye bakar ve parola sürümü/`sessionVersion` yok. Düzeltme: `User.sessionVersion` (veya `passwordChangedAt`) JWT'ye koy, `resolve*`'te karşılaştır; süper-admin için maxAge'i kısalt.

### 10. Caddy ve başlıklar [DOĞRULANDI + KOD]
- Yanıtta bulunanlar: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (`next.config.mjs:2-7`). **Yok:** `Strict-Transport-Security`, `Content-Security-Policy`, `Cross-Origin-Opener-Policy`. Caddy (`Caddyfile`) HSTS'i kendiliğinden eklemez. XSS yüzeyi yok (#19) ama CSP derinlik savunması; HSTS HTTPS kurulumunda şart. Düzeltme: Caddy `header Strict-Transport-Security "max-age=31536000; includeSubDomains"` ve Next için nonce'lu CSP.
- `Caddyfile:10-13` JSON erişim logu istek URI'sini **sorgu dizgesiyle** yazar: `/sifre-belirle?token=…` ve `/giris/sihirli?token=…` (GET sayfası token'ı henüz tüketmeden loglanır; log okuyan, parolayı belirleme formu gönderilmeden önce yarışabilir) ve `/r/<iptalToken>` yolları. T-101 #1 yalnız uygulama logunu kapsıyordu. Düzeltme: Caddy `log` altında `format filter { request>uri query { replace token REDACTED } request>uri path_regexp … }`.
- Gövde sınırı yok: `request_body { max_size 1MB }` ekle (#13).
- `APP_DOMAIN` boşken yalnız HTTP: oturum çerezi Secure olmaz, parola düz gider; `lib/customer-session.ts:11` NODE_ENV=production'da çerezi her durumda `Secure` işaretler → HTTP-only kurulumda müşteri çerezi hiç kaydedilmez (işlevsel hata). README'de HTTPS zorunlu olarak belirtilmeli.

---

## DÜŞÜK

### 11. Staff'ın müşteri taraması [DOĞRULANDI]
`lib/panel/customers.ts:27-37` staff için 3 karakter alt sınırı + 8 sonuç koymuş; ama (a) `q=%%%` LIKE jokeri kaçırılmadan geçiyor (Prisma `contains` joker kaçırmaz; owner tarafında `%%%` → 18/18 eşleşti), (b) staff `GET /api/panel/appointments?from&to` (62 günlük pencereler) ile tüm müşteri ad/telefon/noShowCount'unu zaten alıyor (tüm personelin randevuları dahil). Karar ("staff listeleme yapamaz") fiilen uygulanmıyor. Düzeltme: joker karakterleri kaçır; staff'ı yalnız kendi `Staff.userId` randevularıyla sınırla (şu an hiçbir staff–user bağı kullanılmıyor, `userId` hep null) ya da kararı gevşet.
Not (staff yetkileri) [DOĞRULANDI]: ayarlar/hizmet/personel/izin/çalışma saati/kampanya/SMS talebi/rapor/müşteri detayı staff için 403; randevu oluştur/taşı/durum değiştirme açık (başkasının randevusunu da iptal edebilir). Kodda staff kullanıcı oluşturan bir akış yok (davet yok) — DB'ye elle eklenerek test ettim ve sildim.

### 12. NUL bayt → 500 [DOĞRULANDI]
`GET /api/public/%00/services`, `/api/r/%00aaaaaaaaaaaaaaaaaaaa`, `/api/panel/services/%00`, `/api/panel/customers?q=%00abc` → 500 `internal` (Postgres "invalid byte sequence"). Ayrıntı sızmıyor ama hata logu doldurulabilir ve alarmı tetikler. `phoneSchema`/`slugSchema`/id şemalarına `\u0000` reddi ekle (zod `.refine(s => !s.includes("\0"))`), özellikle `slug`, `token`, `q`, `name`.

### 13. İstek gövdesi sınırsız [DOĞRULANDI]
30 MB JSON `POST /api/public/.../otp/request` tamamen okundu (0,15 sn, 400). `parseJson` (`lib/http.ts`) `req.json()` ile belleğe alıyor. Düzeltme: Caddy `max_size` + route'larda `content-length` kontrolü.

### 14. Bozuk Bearer başlığı middleware'i düşürüyor [DOĞRULANDI]
`curl -H "Authorization: Bearer %%%" /panel` → 500; `/api/panel/*` 401, `/giris` 200. next-auth `getToken` advisory'si (GHSA-xmf8-cvqr-rfgj). Fail-closed; yükseltmeyle kapanır (#1).

### 15. Üretimde bootstrap/seed riskleri [KOD]
Güncelleme (20 Kasım, T147c1): aşağıdaki seed bulguları giderildi; production koşulsuz reddedilir, e2e-prefix silme kaldırıldı, .env.example SUPERADMIN_EMAIL boştur. Mevcut hesaplar otomatik silinmez; operatör eski demo hesaplarını ayrıca denetlemelidir. İlk yönetici bağlantısının yetkili log istisnası sürer.

- `prisma/seed.ts:210-231`: `SEED_DEMO=true` üretimde yanlışlıkla açılırsa `admin@kibrisrandevu.test / admin12345` süper-admin'i (`upsert` ile her açılışta parola sıfırlanır) ve `demo12345` salon sahipleri oluşur. Ayrıca `seed.ts:218-220` slug'ı `e2e-` ile başlayan **tüm gerçek salonları siler** (SEED_DEMO açıkken). Düzeltme: seed'i `NODE_ENV=production` iken tamamen reddet; `e2e-` silmesini sınırla.
- `lib/bootstrap.ts:36`: ilk kurulumda parola belirleme bağlantısı app loguna düz yazılıyor (brief'in belgelenmiş istisnası). Parola belirlenmediği sürece her açılışta yenisi üretilip loglanır; `.env.example:8` varsayılanı `SUPERADMIN_EMAIL=admin@example.com` — değiştirilmeden dağıtılırsa ve logları okuyan biri varsa süper-admin ele geçirilir. Canlı DB'de `admin@example.com` parolasız süper-admin satırı mevcut. Düzeltme: gerçek bir e-posta zorunlu kıl (örnek değerle başlamayı reddet), bağlantıyı yalnız stdout'a bir kez ve kısa TTL ile yaz.

### 16. Kimlik politikası zayıflıkları [KOD]
- Parola: yalnız `min(8).max(72)` (`lib/signup.ts:14`); karakter (bayt değil) sınırı — 72 karakterden fazla bayt tutan Türkçe parolada bcrypt sessizce keser. Yaygın/sızmış parola kontrolü yok. bcrypt maliyeti 10 (`lib/login.ts:11`); ≥12 önerilir.
- `lib/env.ts:9`: `NEXTAUTH_SECRET` için yalnız ≥16 karakter denetimi (zayıf "changemechangeme" geçer). Çalışan sunucuda 32 karakter. `lib/auth-secret.ts`: `NODE_ENV!=production` ise sabit `dev-only-insecure-secret-change-me` → staging'de NODE_ENV unutulursa JWT/müşteri çerezi/OTP özeti sahte üretilebilir.
- Aynı sır JWT, müşteri çerezi HMAC'i ve OTP pepper'ı için kullanılıyor (anahtar ayrımı yok).
- Süper-admin için 2FA yok; JWT 7 gün.
- Kayıt (`/api/auth/signup`): e-posta doğrulaması yok; 409 `field:"email"` ile e-posta kullanımı sızar (`lib/signup.ts:60`); her kayıt 100 ücretsiz SMS kredisi veriyor (`signupSalon`) → IP başına 5/saat ile kredi çiftliği (XFF atlatması #7 ile sınırsız).

### 17. SMS gönderen adı [KOD]
`lib/panel/settings.ts:17` `smsSenderName` `^[A-Za-z0-9 .-]{1,11}$` — tenant "BANKA", "TURKCELL" gibi marka adını serbestçe seçip `sms.send(..., {sender})` ile sağlayıcıya iletiyor (`lib/messaging/send.ts` `sender: tenant.smsSenderName`). Operatör başlık onayı koruyabilir ama platform tarafında izin listesi yok.

### 18. Yedekler [KOD]
20 Kasım T147c2: yerel dosya izinleri giderildi (dizin0700, dump0600, eski düzenli dump izinleri daraltılır). Şifreleme/uzak kopya bu teslim kapsamında uygulanmadı. Aşağıdaki metin ilk bulgudur.

`scripts/backup-loop.sh`: `pg_dump -Fc -f /backups/...` varsayılan umask ile; ana makinedeki `./backups` (docker root) altındaki dosyalar 0644 ⇒ ana makinedeki her yerel kullanıcı tüm kiracı PII'sini (telefon, ad) okuyabilir. Şifreleme/uzak kopya yok. Düzeltme: `umask 077`, dizin 0700, şifreli uzak kopya.

---

## BİLGİ

### 19. Diğer notlar
- İyi: DB portu yayınlanmıyor (`docker-compose.yml`: `db` için `ports` yok, `app` yalnız `expose: 3000`; yalnız Caddy 80/443). Konteyner `node` kullanıcısıyla çalışır; `.dockerignore` `.env*`'i dışlar.
- Doğrulanmış güvenlik başlıkları dışında `/api/*` yanıtlarında `Cache-Control` yok (kişisel veri dönen panel GET'leri için `no-store` eklenebilir).
- `lib/messaging/providers.ts:46` Mock sağlayıcı üretimde alıcı telefonu loglar (PII); metin yazılmaz.
- Slug rezerve listesinde `sifre-belirle` yok (statik rota öncelikli olduğundan yalnız ulaşılamaz bir salon olur); `lib/slug.ts:3`.
- cuid kimlikleri tahmin edilebilir bileşenler içerir; yetkilendirme kimliğe güvenmiyor, sorun değil.
- DB düzeyinde ek savunma yok: tenant tutarlılığı (Appointment.staffId başka salona ait olabilir) yalnız uygulama katmanında; `SmsLedger`'da negatif bakiye/işaret CHECK'i yok (T-118 kapsamı). Ledger toplamı = `balanceAfter` tutarlı [DOĞRULANDI].
- Yeni risk (T-114–T-118 dışı): `lib/billing/payments.ts:18-19` `amountTry: z.number().positive()` + `toFixed(2)` ⇒ `0.001` TL "ödeme" 0.00 TL kaydıyla abonelik uzatır (yalnız süper-admin; bilgi).
- CSRF duruşu: durum değiştiren JSON API'lerde Origin kontrolü ve Content-Type zorunluluğu yok (`parseJson` her gövdeyi JSON okur). Oturum çerezi `SameSite=Lax` (+`HttpOnly`; HTTPS'te `Secure`) olduğu için çapraz-site POST çerezle gitmez; çıkış/giriş Auth.js CSRF token'ıyla korunuyor (`/api/auth/signout` CSRF'siz 302 `MissingCSRF` [DOĞRULANDI]). Aynı-site (alt alan) senaryosu yok (salonlar yol bazlı, aynı origin). Derinlik savunması için `Origin` doğrulaması önerilir.
- Temizlik notu: testlerde oluşturduğum veriyi sildim (5 müşteri, 6 randevu, geçici staff kullanıcısı, 1 OTP satırı + 1 mesaj/defter satırı; salon ayarları null'a geri alındı, kredi bakiyesi 300'e döndü). Temizlik sırasında son 2 saatteki `AuditLog` satırlarından `service.*/settings.update/staff.update` türündeki 76 kaydı da sildim; bunların çoğu 18:27'deki önceki test koşularının artığıydı (kalan 80 satır sağlam). pg-boss'a düşen iş kaydı kalmadı. Ek örnek `:3401` süreci kapatıldı.

---

## Doğrulanan iyi uygulamalar (OK)

Tenant izolasyonu (canlı, ikinci salonun oturumuyla birinci salonun kimlikleri):
- Hizmet GET/PATCH/DELETE, personel PATCH/DELETE, çalışma saatleri GET/PUT, randevu GET/PATCH/status, müşteri GET/PATCH, izin oluşturma (yabancı staffId), hizmet oluşturmada yabancı staffIds, panelden yabancı hizmetle randevu → hepsi **404** [DOĞRULANDI]. Liste uçları yalnız kendi 6 hizmet/3 personel.
- Toplu atama: gövdeye `tenantId`, `id`, `plan`, `status`, `userId`, `priceTry`, `source`, `note`, `status:"completed"` eklemek etkisiz (Zod nesneleri bilinmeyen anahtarı atar; ayarlar `.strict()` ile 400) [DOĞRULANDI]. Genel rezervasyonda fiyat sunucuda `service.priceTry`'dan (450) [DOĞRULANDI].
- Yetki: owner → `/api/admin/*` 403; anonim → panel/admin 401; admin → panel 401; staff yazma uçlarında 403 [DOĞRULANDI]. Rol/tenant her istekte DB'den doğrulanıyor (`lib/session.ts`).
- Rezervasyon: eşleşmeyen personel 404, geçmiş/gelecek 400 gün/ızgara dışı 422, KVKK zorunlu, aynı slotta çift rezervasyon DB exclusion constraint ile (`appointment_no_overlap`, `WHERE status IN (pending, confirmed)`); `any` yarışı yeniden denenir. Askıdaki salon `resolveTenant` ile 423 (kod; bookPublic, slots, OTP).
- İptal token'ı 24 bayt rastgele (`randomBytes(24)`, 32 karakter), `findUnique` ile global benzersiz, iptal penceresi ve çift iptal (`already_closed`) doğru çalışıyor [DOĞRULANDI]; kısa/NUL token 404/500 (#12), 30/dk IP sınırı.
- Giriş token'ları: 32 bayt, yalnız SHA-256 saklanıyor, atomik tek kullanım (`updateMany usedAt:null`), 15 dk/24 sa TTL; üretimde magic-link kapalı (`canSendMagicLink`); e-posta yokken sahte bcrypt ile zamanlama dengeli.
- Müşteri çerezi: HMAC-SHA256, `timingSafeEqual`, 30 dk `exp`, tenant kimliği yük içinde ve salona bağlı çerez adı; `HttpOnly; Secure; SameSite=lax; Path=/` [DOĞRULANDI]. Oturum çerezi HTTPS'te `__Secure-authjs.session-token; HttpOnly; Secure; SameSite=Lax`, CSRF `__Host-` [DOĞRULANDI, :3401].
- XSS: React kaçışı; `dangerouslySetInnerHTML` yalnız JSON-LD'de ve `<` → `<` ile (`app/(public)/[salonSlug]/page.tsx:72`). `<script>` içeren müşteri adı ve `<img onerror>` hizmet adı ham metin olarak saklanıp basılıyor; JSON-LD/`og:image`/`<img src>`/CSS `url("…")` içinde tırnak/`<` kaçışı canlı doğrulandı [DOĞRULANDI]. Logo/kapak/foto URL'si yalnız `https://` (`javascript:`/`http:` 400); sunucu tarafında çekilmiyor → SSRF yok (yalnız istemci tarafı harici görsel/izleme pikseli).
- Host başlığı zehirlemesi: `Host`/`X-Forwarded-Host: evil.com` ile Auth.js URL'leri `NEXTAUTH_URL`'den (yönlendirme `localhost:3000`), e-posta/SMS bağlantıları `appBaseUrl()`/`appUrl()` env'den [DOĞRULANDI]. `callbackUrl=https://evil.com` temizleniyor.
- SQL: ham sorgular yalnız parametreli şablon literali (`$queryRaw` 5 yer, hepsi sabit); SQLi denemesi slug'da 404.
- Para/kredi: kredi miktarı pozitif tamsayı (`assertAmount`), düşümde tenant satır kilidi, bakiye eksiye düşmez; admin ödemesi `positive().max(1e6)`, `months 1..12`; plan fiyatı `0..1e6`; denetim kaydı aynı transaction'da. Plan sınırları: `maxStaff` kilit altında hem oluşturmada hem aktifleştirmede; özellik kapıları (rapor, müşteri notu, kampanya) servis katmanında `assertFeature` (Pro'da kampanya 402 [DOĞRULANDI]). Kampanya yalnız `marketingConsent=true` alıcılara, sessiz saatlerde reddedilir, alt bilgi eklenir (kod; ancak #5).
- Hata sayfaları: 500'de genel mesaj, yığın/SQL ayrıntısı yok; `X-Powered-By` kapalı; `.map` dosyaları 404.
- Git geçmişi (211 commit, tüm dallar): gerçek sır yok (yalnız test parolaları ve boş `.env.example`); `.env` ignore'da. Docker imajı `.env`'i kopyalamaz.
- Compose: `POSTGRES_PASSWORD`/`NEXTAUTH_SECRET` zorunlu (`:?`), worker `SEED_DEMO=false`.
