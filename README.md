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
pnpm db:seed                    # 2 demo salon + süper-admin (üretimde yalnız SEED_DEMO=true ile)
pnpm build && pnpm start        # NEXTAUTH_SECRET ve DATABASE_URL tanımlı olmalı
node tests/e2e/booking.cjs      # 375×812 başsız Playwright: ana sayfa, giriş, kayıt, tam randevu + iptal, 404
```

Ortam değişkenleri: `BASE_URL` (varsayılan `http://localhost:3000`), `SLUG` (varsayılan `lefkosa-usta-berber`), `SHOT_DIR` (ekran görüntüleri `ui-*.png`). Demo girişleri: `owner@lefkosa-usta-berber.test` / `demo12345`, `admin@kibrisrandevu.test` / `admin12345`.
