#!/usr/bin/env bash
# TODO.md §T-SMOKE — yayın sonrası otomatik duman testi (başlıklar ve sağlık uçları).
# Kullanım: bash deploy/smoke.sh https://alanadi.com
set -uo pipefail
BASE="${1:?Kullanim: smoke.sh https://alanadi.com}"
FAIL=0
pass() { echo "  OK   $1"; }
fail() { echo "  HATA $1"; FAIL=1; }

HEAD=$(curl -sSI "$BASE/")
grep -qE '^HTTP/[0-9.]+ 200' <<<"$HEAD" && pass "HTTPS 200" || fail "HTTPS 200"
grep -qi '^strict-transport-security:' <<<"$HEAD" && pass "HSTS" || fail "HSTS"
grep -qiE '^content-security-policy:.*script-src .*sha256-' <<<"$HEAD" && pass "CSP (hash'li script-src)" || fail "CSP"
grep -qi '^x-content-type-options: nosniff' <<<"$HEAD" && pass "nosniff" || fail "nosniff"
grep -qi '^server:' <<<"$HEAD" && fail "Server basligi gizli degil" || pass "Server basligi yok"

code() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
[[ $(code "$BASE/api/health") == 200 ]] && pass "/api/health 200" || fail "/api/health"
[[ $(code "$BASE/api/ready") == 200 ]] && pass "/api/ready 200" || fail "/api/ready"
curl -sSI "$BASE/api/health" | grep -qi '^x-powered-by:' && fail "x-powered-by acik" || pass "x-powered-by yok"
curl -s "$BASE/api/public/site" | grep -q '"navbarTitle"' && pass "/api/public/site" || fail "/api/public/site"
[[ $(code "$BASE/admin") == 200 ]] && pass "SPA /admin" || fail "SPA /admin"
[[ $(code "${BASE/https:/http:}/") =~ ^30[178]$ ]] && pass "HTTP -> HTTPS" || fail "HTTP -> HTTPS"

echo
if [[ $FAIL == 0 ]]; then
  echo "Duman testi GECTI. Elle: admin girisi + 2FA, wallpaper indirme sayaci, SMTP testi, entegrasyon kartlari, gece yedegi."
else
  echo "Duman testi BASARISIZ"
fi
exit $FAIL
