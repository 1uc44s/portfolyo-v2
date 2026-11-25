#!/usr/bin/env bash
# Sunucuda güncelleme. /srv/my-portfolyo içinde my-portfolyo kullanıcısıyla çalışır;
# systemctl/sed için sudoers kaydı gerekir.
set -euo pipefail
cd /srv/my-portfolyo

echo "1/6 Bagimliliklar (npm ci)"
npm ci --no-audit --no-fund

echo "2/6 Prisma client + migration + seed (idempotent)"
set -a; . /etc/my-portfolyo/backend.env; set +a
npm run db:generate -w backend
npm run db:deploy -w backend
npm run db:seed -w backend

echo "3/6 Frontend build"
npm run build

echo "4/6 CSP hash -> Caddy ortami"
SCRIPT_SRC=$(node -e "console.log(require('./frontend/dist/csp-hashes.json').scriptSrc)")
sudo sed -i "s|^CSP_SCRIPT_SRC=.*|CSP_SCRIPT_SRC=$SCRIPT_SRC|" /etc/my-portfolyo/caddy.env

echo "5/6 Yeniden baslatma"
sudo systemctl restart my-portfolyo-api
sudo systemctl restart caddy

echo "6/6 Duman testi"
sleep 3
DOMAIN=$(grep '^SITE_DOMAIN=' /etc/my-portfolyo/caddy.env | cut -d= -f2)
bash deploy/smoke.sh "https://$DOMAIN"
