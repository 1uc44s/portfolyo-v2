#!/usr/bin/env bash
# F19-05 — yedekten geri yükleme provası (DATABASE.md §9). Kaynak veritabanına YAZMAZ:
# pg_dump -Fc → geçici veritabanına pg_restore → tablo satır sayıları karşılaştırılır → geçici DB silinir.
# Kullanım: bash scripts/restore-rehearsal.sh [konteyner] [db] [kullanıcı]
set -euo pipefail
# Git Bash (Windows) /tmp yolunu yerel yola çevirmesin.
export MSYS_NO_PATHCONV=1

CONTAINER="${1:-portfolyo-v2-postgres-1}"
DB="${2:-portfolyo_db}"
USER_NAME="${3:-portfolyo}"
CHECK_DB="${DB}_restore_check"
DUMP="/tmp/${DB}-rehearsal.dump"

psql_in() { docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$1" -Atc "$2"; }

counts() {
  psql_in "$1" "SELECT string_agg(t || '=' || n, ' ' ORDER BY t) FROM (
    SELECT relname AS t, (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', relname), false, true, '')))[1]::text::int AS n
    FROM pg_stat_user_tables WHERE schemaname = 'public') s"
}

echo "1/5 Yedek alınıyor (pg_dump -Fc) → $DUMP"
docker exec "$CONTAINER" pg_dump -U "$USER_NAME" -Fc -f "$DUMP" "$DB"
docker exec "$CONTAINER" ls -l "$DUMP"

echo "2/5 Geçici veritabanı: $CHECK_DB"
docker exec "$CONTAINER" dropdb -U "$USER_NAME" --if-exists "$CHECK_DB"
docker exec "$CONTAINER" createdb -U "$USER_NAME" "$CHECK_DB"

echo "3/5 Geri yükleniyor (pg_restore)"
START=$(date +%s)
docker exec "$CONTAINER" pg_restore -U "$USER_NAME" -d "$CHECK_DB" --no-owner "$DUMP"
echo "    süre: $(( $(date +%s) - START )) sn"

echo "4/5 Satır sayıları karşılaştırılıyor"
SRC=$(counts "$DB")
DST=$(counts "$CHECK_DB")
MIG_SRC=$(psql_in "$DB" "SELECT count(*) FROM _prisma_migrations")
MIG_DST=$(psql_in "$CHECK_DB" "SELECT count(*) FROM _prisma_migrations")
if [[ "$SRC" == "$DST" && "$MIG_SRC" == "$MIG_DST" ]]; then
  echo "    EŞLEŞTİ ($(wc -w <<<"$SRC") tablo, $MIG_DST migration)"
  RESULT=0
else
  echo "    FARK VAR"; echo "    kaynak: $SRC"; echo "    geri yüklenen: $DST"
  RESULT=1
fi

echo "5/5 Temizlik: geçici DB ve dump siliniyor"
docker exec "$CONTAINER" dropdb -U "$USER_NAME" "$CHECK_DB"
docker exec "$CONTAINER" rm -f "$DUMP"
exit $RESULT
