#!/bin/sh
# Günlük pg_dump (-Fc) → /backups/randevu-YYYYmmdd-HHMMSS-XXXXXX.dump; BACKUP_KEEP_DAYS günden eskiler silinir.
# İlk yedek açılışta alınır, sonra her BACKUP_INTERVAL_SECONDS (varsayılan 86400) saniyede bir.
set -eu
umask 077
KEEP="${BACKUP_KEEP_DAYS:-14}"
EVERY="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p /backups
chmod 700 /backups
# Mevcut düzenli yedeklerin eski geniş izinlerini de daralt.
find /backups -type f -name 'randevu-*.dump' -exec chmod 600 {} +
while true; do
  part="$(mktemp "/backups/randevu-$(date -u +%Y%m%d-%H%M%S)-XXXXXX.part")"
  f="${part%.part}.dump"
  if pg_dump -Fc -f "$part" && mv "$part" "$f"; then
    echo "yedek alindi: $f ($(du -h "$f" | cut -f1))"
    # KEEP günden eski yedekleri sil
    find /backups -name 'randevu-*.dump' -type f -mtime +"$((KEEP - 1))" -print -delete | sed 's/^/eski yedek silindi: /'
  else
    echo "YEDEK BASARISIZ" >&2
    rm -f "$part"
  fi
  sleep "$EVERY"
done
