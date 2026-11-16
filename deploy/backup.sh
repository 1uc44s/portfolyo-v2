#!/usr/bin/env bash
# DATABASE.md §9 — gece yedeği (cron 03:30 Europe/Istanbul).
# DB: pg_dump -Fc → age ile şifrelenir. Medya: restic artımlı. Saklama: 14 günlük + 8 haftalık.
# Sunucu dışı kopya: rclone. Ortam: /etc/vasquez/backup.env (bkz. docs/DEPLOY.md §6):
#   PGDATABASE, PGUSER, BACKUP_DIR, AGE_RECIPIENT, STORAGE_ROOT,
#   RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE (opsiyonel), RCLONE_REMOTE (opsiyonel)
set -euo pipefail
umask 077
: "${PGDATABASE:?}" "${BACKUP_DIR:?}" "${AGE_RECIPIENT:?}" "${STORAGE_ROOT:?}"

STAMP=$(TZ=Europe/Istanbul date +%F)
DOW=$(TZ=Europe/Istanbul date +%u)
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
OUT="$BACKUP_DIR/daily/${PGDATABASE}-${STAMP}.dump.age"

echo "[backup] DB -> $OUT"
pg_dump -Fc "$PGDATABASE" | age -r "$AGE_RECIPIENT" > "$OUT.part"
mv "$OUT.part" "$OUT"
if [[ "$DOW" == "7" ]]; then cp "$OUT" "$BACKUP_DIR/weekly/"; fi

echo "[backup] saklama: 14 gunluk, 8 haftalik"
find "$BACKUP_DIR/daily" -name '*.dump.age' -mtime +14 -delete
find "$BACKUP_DIR/weekly" -name '*.dump.age' -mtime +56 -delete

if [[ -n "${RESTIC_REPOSITORY:-}" ]]; then
  echo "[backup] medya -> restic"
  restic backup --quiet --tag vasquez "$STORAGE_ROOT"
  restic forget --quiet --keep-daily 14 --keep-weekly 8 --prune
fi

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  echo "[backup] sunucu disi kopya -> $RCLONE_REMOTE"
  rclone sync --quiet "$BACKUP_DIR" "$RCLONE_REMOTE/db"
fi

echo "[backup] tamam: $(du -h "$OUT" | cut -f1)"
