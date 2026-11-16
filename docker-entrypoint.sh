#!/bin/sh
# (pnpm çalışma zamanında gerekmez: `pnpm worker` ≡ tsx jobs/worker.ts, `pnpm db:seed` ≡ tsx prisma/seed.ts)
# Roller: web (varsayılan) | worker | herhangi bir komut.
#   web:    migrate deploy → (SEED_DEMO=true ise) seed → next standalone sunucusu
#   worker: pg-boss işleyicisi (migration'ı web yapar; compose worker'ı web sağlıklı olunca başlatır)
set -eu

log() { printf '{"level":30,"app":"kibris-randevu","msg":"%s"}\n' "$1"; }
fail() { printf '{"level":60,"app":"kibris-randevu","msg":"%s"}\n' "$1" >&2; exit 1; }

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL tanimli degil"
if [ "${NODE_ENV:-}" = "production" ]; then
  [ -n "${NEXTAUTH_SECRET:-${AUTH_SECRET:-}}" ] || fail "NEXTAUTH_SECRET tanimli degil (uretmek icin: openssl rand -base64 32)"
fi

role="${1:-web}"
case "$role" in
  web)
    log "prisma migrate deploy"
    node node_modules/prisma/build/index.js migrate deploy || fail "migration basarisiz"
    if [ "${SEED_DEMO:-false}" = "true" ]; then
      log "SEED_DEMO=true: demo verisi yukleniyor"
      node_modules/.bin/tsx prisma/seed.ts || fail "seed basarisiz"
    fi
    log "web baslatiliyor"
    exec node .next/standalone/server.js
    ;;
  worker)
    log "worker baslatiliyor"
    exec node_modules/.bin/tsx jobs/worker.ts
    ;;
  *)
    exec "$@"
    ;;
esac
