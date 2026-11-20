# KıbrısRandevu – İşletme El Kitabı (RUNBOOK)

Hedef: tek bir Ubuntu VPS üzerinde Docker Compose ile çalıştırmak. Servisler: `app` (web), `worker` (pg-boss: hatırlatma/abonelik işleri), `db` (Postgres 16), `caddy` (HTTPS ters vekil), `backup` (günlük `pg_dump`).

## 1. İlk kurulum (Ubuntu 22.04/24.04 VPS)

1. **DNS:** alan adının `A` kaydını (ör. `randevu.ornek.com`) sunucunun IP'sine yönlendirin. HTTPS sertifikası için 80 ve 443 portları dışarıya açık olmalı (`sudo ufw allow 80,443/tcp`).
2. **Docker kurulumu:**
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # çıkış/giriş yapın
   docker compose version          # v2 olmalı
   ```
3. **Kodu alın:**
   ```bash
   git clone <REPO_URL> kibris-randevu && cd kibris-randevu
   git checkout claude/kibris-randevu   # (ya da yayın dalı)
   ```
4. **`.env` hazırlayın:**
   ```bash
   cp .env.example .env
   openssl rand -base64 32      # çıktıyı NEXTAUTH_SECRET olarak yazın
   openssl rand -hex 24         # çıktıyı POSTGRES_PASSWORD olarak yazın
   nano .env
   ```
   Doldurulacaklar:
   | Değişken | Açıklama |
   |---|---|
   | `NEXTAUTH_SECRET` | **Zorunlu**, en az 16 karakter. Eksikse uygulama açılmaz (log: `NEXTAUTH_SECRET tanimli degil`). Üretimde sonradan değiştirmeyin: oturumlar ve OTP kodları geçersiz olur. |
   | `POSTGRES_PASSWORD` | **Zorunlu**. `POSTGRES_USER`/`POSTGRES_DB` varsayılan `randevu`. `DATABASE_URL` Compose tarafından buradan kurulur (`.env`'deki `DATABASE_URL` kullanılmaz). |
   | `APP_DOMAIN` | `randevu.ornek.com` → Caddy otomatik HTTPS (Let's Encrypt) alır. **Boş bırakılırsa** yalnız HTTP, `:80` (deneme/IP ile erişim). `NEXTAUTH_URL` boşsa `https://APP_DOMAIN` (alan adı yoksa `http://localhost`) olur; IP ile HTTP denerken `NEXTAUTH_URL=http://SUNUCU_IP` yazın. |
   | `SUPERADMIN_EMAIL` | İlk süper-yönetici e-postası (bkz. 3). |
   | `SMS_PROVIDER`, `ALLOW_REAL_SMS` | Başlangıçta `mock` / `false` bırakın (bkz. 7). |
   | `SEED_DEMO` | Üretimde **`false`**. `true` verilirse seed güvenlik hatasıyla durur; üretim seed hiçbir durumda çalışmaz. |

   `.env` dosyasını asla git'e eklemeyin (`.gitignore`'dadır).

## 2. Başlatma

```bash
docker compose up -d --build
docker compose ps          # app (healthy), worker, db (healthy), caddy, backup çalışmalı
curl -s https://APP_DOMAIN/api/health     # {"ok":true,"db":"up",...}
```
`app` açılırken sırayla `prisma migrate deploy` çalışır; `SEED_DEMO=true` üretim başlangıcını güvenlik hatasıyla durdurur. Demo seed yalnız ayrı geliştirme/test veritabanında kullanılmalıdır. `worker` ve `caddy`, `app` sağlıklı olunca başlar. İlk derleme birkaç dakika sürer. Sunucu yeniden başlarsa servisler `restart: unless-stopped` ile kendiliğinden kalkar.

## 3. Süper-yönetici ilk şifre bağlantısı

`SUPERADMIN_EMAIL` için hesap ilk açılışta oluşur ve şifre belirleme bağlantısı **loga** yazılır (e-posta sağlayıcı henüz Mock):
```bash
docker compose logs app | grep -i "şifre belirleme"
```
Çıktıdaki `…/sifre-belirle?token=…` bağlantısını tarayıcıda açıp şifre belirleyin (tek kullanımlık, süreli). Süresi dolduysa `docker compose restart app`; şifre hâlâ yoksa yeni bağlantı üretilir. Sonra `https://APP_DOMAIN/giris` ile girin → `/admin`.

## 4. Güncelleme

```bash
cd kibris-randevu
git pull
docker compose up -d --build
```
Migration'lar `app` açılırken otomatik uygulanır. Güncellemeden önce elle yedek almak iyi olur (bkz. 5). Geri dönmek için önceki commit'e `git checkout <sha>` yapıp aynı komutu çalıştırın (migration'lar ileri yönlüdür; şema değiştiyse yedekten dönün).

## 5. Yedekler (T-083)

`backup` servisi açılışta ve ardından her 24 saatte `pg_dump -Fc` alır: `./backups/randevu-YYYYMMDD-HHMMSS.dump`. **14 günden** eski dosyalar silinir (`BACKUP_KEEP_DAYS`, `BACKUP_INTERVAL_SECONDS` ile değişir).

```bash
ls -lh backups/                          # yedekler
docker compose logs backup | tail        # son yedek başarılı mı? ("yedek alindi" / "YEDEK BASARISIZ")
docker compose restart backup            # anlık yedek: servis açılışta hemen bir yedek alır
```
Önemli: yedekler aynı sunucudadır. Diske zarar gelirse kaybolur; `./backups` klasörünü düzenli olarak başka yere kopyalayın (ör. `rsync -a backups/ kullanici@baska-sunucu:/yedek/randevu/`).

### Geri yükleme

```bash
# 1) Uygulamayı durdurun (veritabanı açık kalır)
docker compose stop app worker caddy
# 2) Veritabanını sıfırdan oluşturup yedeği yükleyin
docker compose exec -T db psql -U randevu -d postgres -c 'DROP DATABASE IF EXISTS randevu WITH (FORCE)' -c 'CREATE DATABASE randevu'
docker compose exec -T db pg_restore -U randevu -d randevu --no-owner < backups/randevu-YYYYMMDD-HHMMSS.dump
# 3) Servisleri kaldırın
docker compose up -d
docker compose exec -T db psql -U randevu -c 'select count(*) from "Tenant"'   # kontrol
```
(`POSTGRES_USER`/`POSTGRES_DB` değiştirdiyseniz komutlardaki `randevu` yerine onları yazın.) Geri yükleme provası yılda en az bir kez ayrı bir ortamda yapılmalıdır.

## 6. Logları okuma

```bash
docker compose logs -f app            # web (JSON satırları; level 30 info, 40 uyarı, 50 hata)
docker compose logs -f worker         # hatırlatma/abonelik işleri ("iş tamam", "iş hatası")
docker compose logs --since 1h caddy  # erişim logu + sertifika durumu
docker compose logs db | tail
docker compose logs app | grep '"level":50'   # yalnız hatalar
```
`LOG_LEVEL` (`.env`) ile ayrıntı ayarlanır; değişince `docker compose up -d`.

## 7. SMS sağlayıcısını değiştirme

Gerçek SMS iki şeye bağlıdır: **`ALLOW_REAL_SMS=true`** ve sağlayıcının kimlik bilgileri. Aksi halde sistem uyarı loglayıp Mock'a (gönderilmiş gibi kaydeder, gerçekte göndermez) düşer.

1. Sağlayıcıyı seçin: `.env` içinde `SMS_PROVIDER=netgsm` | `iletimerkezi` | `generic_http`.
2. Kimlik bilgilerini girin:
   - **Netgsm:** `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` (onaylı başlık)
   - **İleti Merkezi:** `ILETIMERKEZI_KEY`, `ILETIMERKEZI_HASH`, `ILETIMERKEZI_SENDER`
   - **Genel HTTP:** `GENERIC_SMS_URL`, `GENERIC_SMS_METHOD`, `GENERIC_SMS_TOKEN`, `GENERIC_SMS_PARAMS` (yer tutucular `{to} {text} {sender} {token}`), isteğe bağlı `GENERIC_SMS_TOKEN_HEADER`, `GENERIC_SMS_OK_REGEX`
3. Gerçek gönderimi açın: `ALLOW_REAL_SMS=true`.
4. `docker compose up -d` (app ve worker yeniden oluşur) → ardından tek bir test randevusuyla gönderimi doğrulayın; `docker compose logs worker | tail` içinde "iş tamam", panelde mesaj kaydı ve kredi düşümü görülmeli. Sağlayıcı hata verirse kredi iade edilir (log: "SMS gönderilemedi, kredi iade edildi").

Salon bazında farklı sağlayıcı gerekiyorsa `Tenant.smsProvider` alanı `SMS_PROVIDER`'ı geçersiz kılar. Geri almak için `ALLOW_REAL_SMS=false` yapmak yeterlidir. WhatsApp (`WHATSAPP_*`) da aynı kapıya bağlıdır.

## 8. Sorun giderme

| Belirti | Bakılacak yer / çözüm |
|---|---|
| `docker compose up` hemen hata veriyor: `NEXTAUTH_SECRET .env içinde tanımlı olmalı` | `.env` eksik. Bölüm 1.4. |
| `app` sürekli yeniden başlıyor | `docker compose logs app`: `NEXTAUTH_SECRET tanimli degil` / `DATABASE_URL`, `migration basarisiz` (db sağlıklı mı? parola `.env`'de sonradan değiştiyse db hacmindeki eski parolayla uyuşmaz → `ALTER USER` ya da hacmi sıfırlayın) |
| Site açılmıyor, sertifika alınamıyor | DNS A kaydı doğru mu (`dig +short APP_DOMAIN`), 80/443 açık mı, `docker compose logs caddy` içinde ACME hatası. Let's Encrypt sınırlarına takılmamak için tekrar denemeleri seyrek yapın. |
| Giriş sonrası döngü / `localhost`'a yönlendirme | `NEXTAUTH_URL` yanlış; alan adı `https://APP_DOMAIN` olmalı. |
| SMS gitmiyor | Bölüm 7: `ALLOW_REAL_SMS`, sağlayıcı değerleri; `docker compose logs app worker | grep -i sms`; panelde SMS bakiyesi; hatırlatma işi için `worker` çalışıyor mu (`docker compose ps`). |
| Hatırlatmalar planlanıyor ama gönderilmiyor | `worker` kapalı/çöküyor: `docker compose logs worker`; `docker compose up -d worker`. |
| `/api/health` 503 (`db: down`) | `docker compose ps db`, `docker compose logs db`; disk dolu mu (`df -h`). |
| Disk doluyor | `docker system df`; `docker image prune -f`; `./backups` ve `docker compose logs` boyutu. |
| Her şeyi sıfırdan kurmak (VERİ SİLİNİR) | `docker compose down -v` (hacimler silinir). Önce yedek alın. |
