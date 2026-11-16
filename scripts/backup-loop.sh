#!/bin/sh
# Günlük pg_dump (-Fc) → /backups/randevu-YYYYmmdd-HHMMSS.dump; BACKUP_KEEP_DAYS günden eskiler silinir.
# İlk yedek açılışta alınır, sonra her BACKUP_INTERVAL_SECONDS (varsayılan 86400) saniyede bir.
set -u
KEEP="${BACKUP_KEEP_DAYS:-14}"
EVERY="${BACKUP_INTERVAL_SECONDS:-86400}"
mkdir -p /backups
while true; do
  f="/backups/randevu-$(date -u +%Y%m%d-%H%M%S).dump"
  if pg_dump -Fc -f "$f.part" && mv "$f.part" "$f"; then
    echo "yedek alindi: $f ($(du -h "$f" | cut -f1))"
    # KEEP günden eski yedekleri sil
    find /backups -name 'randevu-*.dump' -type f -mtime +"$((KEEP - 1))" -print -delete | sed 's/^/eski yedek silindi: /'
  else
    echo "YEDEK BASARISIZ" >&2
    find /backups -name '*.part' -type f -delete
  fi
  sleep "$EVERY"
done
