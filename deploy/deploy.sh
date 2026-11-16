#!/usr/bin/env bash
# docs/DEPLOY.md §4 — sunucuda güncelleme. /srv/vasquez içinde vasquez kullanıcısıyla çalışır;
# systemctl/sed için sudoers kaydı gerekir (bkz. DEPLOY.md §2).
set -euo pipefail
cd /srv/vasquez

echo "1/6 Bagimliliklar (npm ci)"
npm ci --no-audit --no-fund

echo "2/6 Prisma client + migration + seed (idempotent)"
set -a; . /etc/vasquez/backend.env; set +a
npm run db:generate -w backend
npm run db:deploy -w backend
npm run db:seed -w backend

echo "3/6 Frontend build"
npm run build

echo "4/6 CSP hash -> Caddy ortami"
SCRIPT_SRC=$(node -e "console.log(require('./frontend/dist/csp-hashes.json').scriptSrc)")
sudo sed -i "s|^CSP_SCRIPT_SRC=.*|CSP_SCRIPT_SRC=$SCRIPT_SRC|" /etc/vasquez/caddy.env

echo "5/6 Yeniden baslatma"
sudo systemctl restart vasquez-api
sudo systemctl restart caddy

echo "6/6 Duman testi"
sleep 3
DOMAIN=$(grep '^SITE_DOMAIN=' /etc/vasquez/caddy.env | cut -d= -f2)
bash deploy/smoke.sh "https://$DOMAIN"
