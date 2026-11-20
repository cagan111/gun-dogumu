# KıbrısRandevu

KKTC salonları için çok kiracılı randevu SaaS'ı. Ürün belgesi: `docs/BRIEF.md`, görevler: `docs/TASKS.md`.

```bash
cp .env.example .env      # DATABASE_URL'i ayarla
pnpm install
pnpm prisma migrate deploy
pnpm dev                   # http://localhost:3000, /api/health
pnpm run ci                # lint + typecheck + test
```

## Demo veri ve tarayıcı kontrolü

```bash
pnpm db:seed                    # 2 demo salon + süper-admin (yalnız geliştirme/test; üretimde reddedilir)
pnpm build && pnpm start        # NEXTAUTH_SECRET ve DATABASE_URL tanımlı olmalı
node tests/e2e/booking.cjs      # 375×812 başsız Playwright: ana sayfa, giriş, kayıt, tam randevu + iptal, 404
node tests/e2e/panel.cjs        # salon paneli (takvim, hizmet, müşteri, rapor, ayar) + süper-admin (ödeme, kredi, denetim); ödeme/hizmet ekler → önce `pnpm db:seed`
JOBS_QUEUE=pgboss pnpm start   # flow.cjs için iş kuyruğu AÇIK olmalı (sunucuyu bu ortamla başlatın)
node tests/e2e/flow.cjs         # T-082: /kayit sihirbazı → panelde hizmet → müşteri randevusu → hatırlatma işi pgboss.job'da → /r/{token} iptali (seed gerekmez, her seferinde yeni salon)
node tests/e2e/isolation.cjs    # T-081: gerçek HTTP; A sahibi B'nin randevu/müşteri/hizmet kimlikleriyle → 404; oturumsuz 401; staff rapor/müşteri ayrıntısı 403
```

`flow.cjs` + `isolation.cjs` toplam 3 kayıt açar; kayıt IP başına saatte 5 ile sınırlı (bellek içi) — tekrar çalıştırmadan önce sunucuyu yeniden başlatın.

## Dağıtım

`docker compose up -d --build` (app, worker, Postgres 16, Caddy, günlük yedek). Kurulum, güncelleme, yedek/geri yükleme ve sorun giderme: `docs/RUNBOOK.md`. CI: `.github/workflows/ci.yml`.

Ortam değişkenleri: `BASE_URL` (varsayılan `http://localhost:3000`), `SLUG` (varsayılan `lefkosa-usta-berber`), `SHOT_DIR` (ekran görüntüleri `ui-*.png`). Demo girişleri: `owner@lefkosa-usta-berber.test` / `demo12345`, `admin@kibrisrandevu.test` / `admin12345`.

Tenant kapsamlı veri erişiminin desteklediği işlemler ve güvenilir SQL yardımcıları: [TENANT-BOUNDARY](docs/TENANT-BOUNDARY.md).

Doğrulanmış pazarlama tercihi ve eski izinlerin geçişi: [MARKETING-CONSENT](docs/MARKETING-CONSENT.md).

Docker/Caddy kurulumu için oturum sırrından farklı, en az 32 karakter rastgele `PROXY_SHARED_SECRET` doldurulmalıdır. Compose proxy güvenini açar; doğrudan başlatmada güven varsayılan kapalıdır. Ayrıntı: [PROXY-TRUST](docs/PROXY-TRUST.md).
