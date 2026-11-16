# KıbrısRandevu

KKTC salonları için çok kiracılı randevu SaaS'ı. Ürün belgesi: `docs/BRIEF.md`, görevler: `docs/TASKS.md`.

```bash
cp .env.example .env      # DATABASE_URL'i ayarla
pnpm install
pnpm prisma migrate deploy
pnpm dev                   # http://localhost:3000, /api/health
pnpm run ci                # lint + typecheck + test
```
