# DEPLOY.md — Üretim Dağıtımı, İlk Kurulum, Yedekleme ve İşletim

> Şartname §27 teslim dokümanı. Ortam değişkenleri: `backend/.env.production.example`. Dosyalar: `deploy/` dizini.
> Bu dokümanda **hiçbir gerçek secret yoktur**; tüm değerler sunucuda `/etc/vasquez/*.env` dosyalarına yazılır.

## 1. Gereksinimler

| Bileşen | Sürüm | Not |
|---|---|---|
| Sunucu | Ubuntu 24.04 LTS, 2 vCPU, 2 GB RAM, 40 GB disk | Medya büyüdükçe disk/S3 |
| Node.js | 24 LTS | `/usr/bin/node` |
| PostgreSQL | 17 | Yalnızca `127.0.0.1` dinler |
| Caddy | 2.8+ | Otomatik TLS (Let's Encrypt) |
| FFmpeg | apt paketi | Video poster/önizleme |
| Yedek araçları | `age`, `restic`, `rclone` | §6 |
| Alan adı | A/AAAA kaydı sunucuya | `www` → çıplak alan adına yönlendirilir |

Dış hesaplar (panelden girilir, env'e **yazılmaz**): SMTP (Hesap Ayarları > E-posta), Discord bot, Spotify uygulaması, GitHub kullanıcı adı (Durumlar). Cloudflare Turnstile anahtarları env'de (prod'da zorunlu).

## 2. Sunucu hazırlığı (bir kez)

```bash
sudo adduser --system --group --home /srv/vasquez vasquez
sudo mkdir -p /etc/vasquez /var/lib/vasquez/storage /var/log/vasquez /var/backups/vasquez
sudo chown vasquez:vasquez /var/lib/vasquez/storage /var/log/vasquez /var/backups/vasquez
sudo chmod 750 /var/lib/vasquez/storage /var/backups/vasquez
sudo apt install -y postgresql-17 caddy ffmpeg age restic rclone
sudo -u postgres createuser --pwprompt portfolyo     # şifre parola yöneticisinden
sudo -u postgres createdb -O portfolyo portfolyo_db
```

`deploy.sh`'ın yalnızca gerekli komutları çalıştırabilmesi için `/etc/sudoers.d/vasquez`:

```text
vasquez ALL=(root) NOPASSWD: /usr/bin/systemctl restart vasquez-api, /usr/bin/systemctl restart caddy, /usr/bin/sed -i s|^CSP_SCRIPT_SRC=* /etc/vasquez/caddy.env
```

## 3. İlk kurulum

1. Kaynağı `/srv/vasquez`'e kopyala (git clone ya da rsync); sahip `vasquez`.
2. Ortam dosyaları (mod `640`, sahip `root:vasquez`):
   - `/etc/vasquez/backend.env` ← `backend/.env.production.example`; secret'ları dosyadaki komutlarla üret. **`APP_ENCRYPTION_KEY`'i parola yöneticisinde ayrıca sakla** — kaybolursa 2FA, SMTP ve entegrasyon secret'ları çözülemez.
   - `/etc/vasquez/caddy.env`:
     ```dotenv
     SITE_DOMAIN=alanadi.com
     ACME_EMAIL=bildirim@alanadi.com
     VASQUEZ_DIST=/srv/vasquez/frontend/dist
     CSP_SCRIPT_SRC='self'
     ```
3. Servisler:
   ```bash
   sudo cp deploy/vasquez-api.service /etc/systemd/system/
   sudo systemctl edit caddy   # [Service] EnvironmentFile=/etc/vasquez/caddy.env
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl daemon-reload && sudo systemctl enable vasquez-api caddy
   ```
4. İlk dağıtım: `sudo -u vasquez bash deploy/deploy.sh` (bağımlılık, migration, seed, build, CSP hash, yeniden başlatma, duman testi).
5. Cron: `sudo cp deploy/crontab /etc/cron.d/vasquez` (§6).

## 4. Güncelleme

```bash
cd /srv/vasquez && sudo -u vasquez git pull   # ya da yeni sürümü rsync'le
sudo -u vasquez bash deploy/deploy.sh
```

**Link önizlemesi (Discord, WhatsApp, X…):** sayfa HTML'i API'den gelir; API `FRONTEND_DIST/index.html`'e sayfa başına başlık, açıklama ve `og:*`/`twitter:*` etiketlerini (site adı, hero sloganı, profil görseli; proje sayfasında proje adı, özeti ve kapağı) ekler. Gereken: `/etc/vasquez/backend.env` içinde `FRONTEND_DIST=/srv/vasquez/frontend/dist` ve güncel `deploy/Caddyfile` (`sudo cp deploy/Caddyfile /etc/caddy/Caddyfile`). Kontrol: `curl -s https://ALAN_ADI/ | grep og:title`. Paylaşım uygulamaları önizlemeyi bir süre önbellekte tutar; Discord'da linkin sonuna `?v=2` eklemek yenisini çeker.

`deploy.sh` sırası: `npm ci` → `prisma generate` → `prisma migrate deploy` → `db:seed` (idempotent; içerik ezmez) → `npm run build` → `frontend/dist/csp-hashes.json`'daki `scriptSrc`'yi Caddy ortamına yazar → `vasquez-api` ve Caddy yeniden başlar → `deploy/smoke.sh`.
Geri alma: önceki sürüme dön ve aynı betiği çalıştır. Migration'lar geri alınmaz; şema değişikliği içeren sürümden önce yedek al (§6). Prod'da `migrate reset` **asla** çalıştırılmaz.

## 5. Admin ilk kurulum (FR-SETUP)

HTTP üzerinden kurulum ucu yoktur; ilk süper admin sunucuda CLI ile açılır:

```bash
cd /srv/vasquez && set -a && . /etc/vasquez/backend.env && set +a
sudo -E -u vasquez npm run admin:create -w backend      # e-posta + şifre etkileşimli sorulur
```

- Şifre en az 12 karakter ve güç kontrolünden geçmeli; hesap `mustChangePassword` ile açılır → ilk girişte şifre değiştirilir.
- Girişten sonra: **Hesap Ayarları > İki Aşamalı Doğrulama'yı aç**, kurtarma kodlarını sakla; **E-posta Gönderimi**'ni (SMTP) ayarla ve test et.
- Kurtarma (SMTP yokken): `admin:reset-password`, `admin:reset-2fa`, `admin:unlock` (`backend/scripts/`).
- `admin:dev-set` **yalnızca geliştirme** içindir; `NODE_ENV=production`'da çalışmaz.

## 6. Yedekleme

- **Ne:** PostgreSQL (`pg_dump -Fc`, `age` ile şifreli) + medya klasörü (`/var/lib/vasquez/storage`, `restic` artımlı). İkisi aynı pencerede (03:30) alınır.
- **Saklama:** 14 günlük + 8 haftalık. Sunucu dışı kopya `rclone` ile (ör. Backblaze B2, S3).
- **Kurulum:**
  ```bash
  age-keygen -o ~/vasquez-backup.key        # ÖZEL anahtarı sunucuda bırakma; parola yöneticisine al
  restic -r <repo> init
  ```
  `/etc/vasquez/backup.env` (mod 600, sahip vasquez):
  ```dotenv
  PGDATABASE=portfolyo_db
  PGUSER=portfolyo
  BACKUP_DIR=/var/backups/vasquez
  AGE_RECIPIENT=age1...            # yalnızca açık anahtar
  STORAGE_ROOT=/var/lib/vasquez/storage
  RESTIC_REPOSITORY=b2:kova:vasquez-media
  RESTIC_PASSWORD_FILE=/etc/vasquez/restic.pass
  RCLONE_REMOTE=b2:kova
  ```
  PostgreSQL şifresi `~vasquez/.pgpass` dosyasında (mod 600).
- **Zamanlama:** `deploy/crontab` → `/etc/cron.d/vasquez` (03:30 Europe/Istanbul). Log: `/var/log/vasquez/backup.log`.
- `APP_ENCRYPTION_KEY` yedekle aynı yerde tutulmaz ama yedek onsuz işe yaramaz: ayrı ve güvenli sakla.

## 7. Geri yükleme ve prova

Aylık prova (cron hatırlatır). Kaynak veritabanına yazmadan:

```bash
age -d -i ~/vasquez-backup.key vasquez-YYYY-MM-DD.dump.age > /tmp/v.dump
createdb portfolyo_db_restore_check && pg_restore -d portfolyo_db_restore_check --no-owner /tmp/v.dump
# satır sayılarını karşılaştır, sonra: dropdb portfolyo_db_restore_check && rm /tmp/v.dump
restic -r <repo> restore latest --target /tmp/media-check   # sha256 karşılaştırması
```

Yerel/dev provası tek komut: `bash scripts/restore-rehearsal.sh` (Docker konteyneri; 2026-11-15'te 32 tablo + 3 migration eşleşti, ~2 sn).

**Felaket kurtarma:** servisi durdur → boş DB → `pg_restore` → medyayı `restic restore` ile `STORAGE_ROOT`'a → aynı `APP_ENCRYPTION_KEY` ile `backend.env` → `deploy.sh`.

## 8. Zamanlanmış işler (cron / rotasyon)

Uygulama işleri API sürecinde `backend/src/jobs/scheduler.js` ile çalışır (ayrı cron gerekmez; tek instance varsayımı):

| İş | Ne zaman (Europe/Istanbul) | Ne yapar |
|---|---|---|
| Günlük tuz + rotasyon | 00:00 (+ açılışta, + saatlik "ensure") | Ziyaretçi hash tuzunu yeniler; arka plan, müzik, profil, cursor için günün içeriğini seçer (tekrarsız döngü, advisory lock) |
| İletişim saklama | 00:00 + açılış | 12 ayı dolan mesajları siler |
| `retention.cleanup` | 00:00 + açılış | Analitik 13 ay, indirme hash'i 90 gün (NULL), audit 24 ay, oturum 30 gün, sıfırlama bağlantısı 7 gün |
| Entegrasyonlar | GitHub 1 sa, Spotify 60 sn, Discord kalıcı + 5 dk | Snapshot; hatada üstel bekleme ≤ 15 dk |
| `storage.gc` | Dakikada bir | Silme kuyruğundaki medya dosyaları |
| `uploads.tmpCleanup` | Saatte bir | 24 saatten eski geçici yüklemeler |
| Yedek | 03:30 (sistem cron'u) | §6 |

Gün hesapları sunucu saat diliminden bağımsız olarak Europe/Istanbul'dur. Kapalıyken kaçırılan rotasyonu açılış/saatlik "ensure" tamamlar.

## 9. İzleme

- **Uptime:** dış izleyici (UptimeRobot, Better Stack…) `https://alanadi.com/api/ready` için 1–5 dk, 2 ardışık hatada bildirim. `/api/ready` DB'ye ping atar; `/api/health` yalnızca süreç canlılığı.
- **Loglar:** API → journald (`journalctl -u vasquez-api -f`, JSON; secret ve mesaj içeriği redakte). Caddy → `/var/log/caddy/vasquez.access.log`. Yedek → `/var/log/vasquez/backup.log`.
- **Panel:** Dashboard uyarı kartları (2FA kapalı, SMTP yok, entegrasyon hatası, başarısız medya), Durumlar ekranındaki son hata.
- **Disk:** `df -h /var/lib/vasquez` haftalık; Dashboard > Depolama.

## 10. Yayın sonrası duman testi

```bash
bash deploy/smoke.sh https://alanadi.com
```

Otomatik: HTTPS 200, HSTS, hash'li CSP, nosniff, `Server`/`X-Powered-By` gizli, `/api/health` ve `/api/ready`, `/api/public/site`, SPA yönlendirmesi, HTTP→HTTPS. Elle: admin girişi + 2FA, wallpaper yükle → public'te gör → indir → sayaç +1, bugünün rotasyonu, SMTP testi + şifremi unuttum e-postası, açık entegrasyon kartları, ertesi sabah yedek dosyası ve sunucu dışı kopya.

## 11. Sorun giderme

| Belirti | Bak |
|---|---|
| API başlamıyor | `journalctl -u vasquez-api` — env doğrulaması eksik/zayıf değişkeni adıyla yazar (Turnstile anahtarları prod'da zorunlu) |
| 502 | `systemctl status vasquez-api`; port 4000 dinliyor mu |
| Turnstile "doğrulama başarısız" | Site anahtarının alan adı listesi; `TURNSTILE_SECRET_KEY` |
| Video yüklemesi 503 | `FFMPEG_PATH` / `ffmpeg -version` |
| Rate limit herkese aynı | Caddy tek hop mu, `TRUST_PROXY=1` mi |
| Spotify bağlanmıyor | Spotify uygulamasındaki Redirect URI = Durumlar ekranındaki değer (HTTPS alan adı) |
| Stats kartı "alınamıyor" | Genel `github-readme-stats` örneği kapalı olabilir → kendi örneğini kur, `GITHUB_STATS_BASE_URL` |
