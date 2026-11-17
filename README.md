# vasquez-portfolyo

Kişisel portfolyo ve dinamik medya CMS'i. Ziyaretçiye sinematik bir ana sayfa (günlük değişen video arka plan,
müzik, imleç, profil), indirilebilir duvar kağıtları ve profil fotoğrafları, projeler, linkler, Discord /
Spotify / GitHub canlı durum kartları ve bir iletişim formu sunar. Tüm içerik, kod bilgisi gerektirmeyen bir
yönetim panelinden yönetilir.

**Yığın:** React 19 (Vite, Tailwind v4, shadcn/ui) · Express 5 · Prisma 7 + PostgreSQL · **yalnızca JavaScript /
JSX, TypeScript yok.** npm workspaces (`frontend`, `backend`, `packages/shared`).

> Projenin tek doğruluk kaynağı [`docs/`](docs/) dizinidir. Yeni özellik önce dokümana yazılır, sonra kodlanır.

---

## İçindekiler

- [Öne çıkan özellikler](#öne-çıkan-özellikler)
- [Gereksinimler](#gereksinimler)
- [Hızlı başlangıç (geliştirme)](#hızlı-başlangıç-geliştirme)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Komutlar](#komutlar)
- [Dizin yapısı](#dizin-yapısı)
- [Güvenlik](#güvenlik)
- [Public API](#public-api)
- [Admin API](#admin-api)
- [Yönetim paneli kullanımı](#yönetim-paneli-kullanımı)
- [Medya hattı](#medya-hattı)
- [Entegrasyonlar](#entegrasyonlar)
- [Üretime dağıtım](#üretime-dağıtım)
- [Dokümanlar](#dokümanlar)

---

## Öne çıkan özellikler

- **Açılış akışı:** Bağlanma ekranı (`Connecting…` + ilerleme çubuğu, 5 sn), ardından `Successfully Connected!` ve
  tıklamayla giriş. Giriş yapılana kadar yalnızca sahne arka planı görünür; tıklamada ada navbar yukarıdan iner.
- **Günlük rotasyon:** Arka plan, müzik, profil fotoğrafı, imleç seti ve "isim efekti" GIF katmanı her gün
  otomatik seçilir (Europe/Istanbul). Admin elle seçip (override) gün sonuna kadar sabitleyebilir.
- **Hero:** İsim efektleri (`NEON`, `GRADIENT`, soldan sağa akan `GRADIENT_ANIMATED`, günün GIF'i `OVERLAY`),
  iki renkli gradyan, slogan ve konum.
- **Canlı durum kartları:** Discord (etkinlik, Spotify, ses kanalı, rozetler, banner), Spotify (çalan parça +
  ilerleme), GitHub (istatistik kartları). SSE ile sayfa yenilemeden canlı güncellenir.
- **İndirilebilir medya:** Duvar kağıtları (arka planlarda `isWallpaper` bayrağı) ve profil fotoğrafları;
  keyset sayfalama, EXIF'siz indirme varyantı, tekilleştirilmiş günlük indirme sayacı.
- **Tech Stack halkaları (çoğaltılabilir bölümler):** "My Tech Stack", "My Security Skill" gibi her bölüm kendi
  başlığı ve öğeleriyle ayrı bir halka; admin'den bölüm eklenir/sıralanır/silinir. **Yağan öğeler** (görsel/emoji), **projeler + kategoriler**, **linkler**, **Hakkımda**
  (güvenli Markdown), **TON 618 temalı 404** (video arka plan).
- **Yönetim paneli:** Rol bazlı (SUPER_ADMIN / EDITOR), 2FA (TOTP + kurtarma kodları), audit log, dashboard,
  içerik yönetimi, entegrasyon ve mail ayarları.

---

## Gereksinimler

- **Node.js 24 LTS** (`.nvmrc`) ve **npm 11+**
- **Docker** (geliştirme PostgreSQL ve Mailpit için)
- **FFmpeg:** ek kurulum gerekmez — npm ile gelir (`ffmpeg-static`, `@ffprobe-installer/ffprobe`). Ortam
  `FFMPEG_PATH` / `FFPROBE_PATH` verilirse onlar kullanılır (prod'da apt sürümü önerilir). Yalnızca video (MP4)
  yüklemek için gerekir.

---

## Hızlı başlangıç (geliştirme)

```bash
npm install
cp .env.example .env
cp backend/.env.example backend/.env
npm run db:up                 # Docker: PostgreSQL + Mailpit
npm run db:deploy -w backend  # migration'ları uygula
npm run db:seed -w backend    # sistem kayıtları + varsayılan linkler (idempotent)
npm run dev                   # backend (watch) + frontend birlikte
```

İlk yönetici (geliştirme) — varsayılan süper admin:

```bash
npm run admin:dev-set -w backend -- --default
```

| Alan | Varsayılan değer |
|---|---|
| E-posta | `1uc44s@github.com` |
| Şifre | `CreatedWithAiByLucas` |
| Rol | `SUPER_ADMIN` |

Komut hesap yoksa oluşturur, varsa şifresini bu değere sıfırlar (oturumlar kapanır). Farklı bir hesap için:
`npm run admin:dev-set -w backend -- --email you@example.com` (şifre gizli sorulur).

> **Uyarı:** Bu şifre depoda açık yazılıdır; yalnızca yerel geliştirme içindir ve komut
> `NODE_ENV=production` iken çalışmaz. Üretimde ilk yöneticiyi `admin:create` ile güçlü, benzersiz bir
> şifreyle oluştur ([DEPLOY.md §5](docs/DEPLOY.md)).

Adresler:

- **Frontend:** http://localhost:5173
- **Yönetim paneli:** http://localhost:5173/admin
- **API sağlık:** http://localhost:4000/api/health (frontend `/api` ve `/media` yollarını proxy'ler)
- **Mailpit** (dev e-posta kutusu): http://localhost:8025
- **PostgreSQL** (Docker): `127.0.0.1:5447` (yalnızca localhost'a bağlı, ağa açık değil)

---

## Ortam değişkenleri

Örnek dosyalar: `.env.example` (kök, Docker için) ve `backend/.env.example`. Gerçek secret'lar **hiçbir
dokümanda veya kaynak kodda yoktur.** Başlıca anahtarlar (tam liste için [ARCHITECTURE.md](docs/ARCHITECTURE.md)):

| Değişken | Amaç |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantısı |
| `JWT_ACCESS_SECRET` | Erişim token imzası (≥ 64 karakter) |
| `CSRF_SECRET` | CSRF ve imzalı state çerezleri |
| `APP_ENCRYPTION_KEY` | AES-256-GCM anahtarı (base64, 32 byte) — entegrasyon secret'ları, 2FA, mail şifresi |
| `PUBLIC_ORIGIN` / `CORS_ORIGINS` | Site adresi; origin ve yönlendirme kontrolü |
| `TURNSTILE_*` | Cloudflare Turnstile — iletişim formu ve admin girişi bot doğrulaması. Geliştirmede boşsa Cloudflare'in her zaman geçen test anahtarları kullanılır; **prod'da zorunlu** |

---

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Backend (yalnızca `backend/src` izlenir) ve frontend'i birlikte başlatır. `backend/.env` değişince sunucuyu elle yeniden başlat |
| `npm run build` | Frontend production build'i (tüm workspace'ler) |
| `npm run lint` | ESLint (uyarı da hata sayılır) |
| `npm run format` / `format:check` | Prettier yaz / kontrol et |
| `npm run check:no-ts` | Depoda TypeScript dosyası olmadığını doğrular |
| `npm run verify` | CI kontrollerini yerelde çalıştırır: `check:no-ts` + lint + format + build |
| `npm run db:up` / `db:down` | Geliştirme PostgreSQL + Mailpit (Docker) |
| `npm run db:deploy -w backend` | Bekleyen migration'ları uygular (prod/CI) |
| `npm run db:migrate -w backend` | Şema değişikliğinden yeni migration üretir ve uygular (dev) |
| `npm run db:seed -w backend` | Sistem kayıtlarını oluşturur (idempotent, mevcut içeriği ezmez) |
| `npm run db:studio -w backend` | Prisma Studio |
| `npm run admin:dev-set -w backend -- --default` | Geliştirme: varsayılan admini (`1uc44s@github.com`) oluştur / şifresini sıfırla |
| `npm run admin:create -w backend` | İlk süper admin (prod kurulumu, [DEPLOY.md §5](docs/DEPLOY.md)) |
| `bash scripts/restore-rehearsal.sh` | Yedekten geri yükleme provası (dev DB, kaynağa yazmaz) |

---

## Dizin yapısı

```text
docs/              Tek doğruluk kaynağı (PRD, SRS, mimari, DB, API, güvenlik…)
packages/shared/   Ortak sabitler, Zod şemaları (istemci + sunucu), metin yardımcıları
backend/           Express API — src/app.js (uygulama), src/server.js (giriş), prisma/ (şema + migration)
  ├─ src/modules/  auth, admins, media, content, techstack, falling, integrations, public, analytics…
  ├─ src/jobs/     rotasyon, medya işleme kuyruğu, depo çöp toplama, günlük tuz
  └─ scripts/      admin yönetimi, dev yardımcıları (reset-defaults, tech-stack-import)
frontend/          React SPA (Vite, Tailwind v4, shadcn/ui, TanStack Query, Zustand, Motion)
  ├─ src/features/ hero, scene, status, player, projects, links, downloads, welcome, layout, motion…
  ├─ src/admin/    yönetim paneli (ayrı lazy chunk)
  └─ public/       favicon, robots.txt, ton-618 video (404)
deploy/            Üretim: Caddyfile, systemd servisi, deploy/backup/smoke betikleri, crontab
```

---

## Güvenlik

- **Şifreler:** admin şifreleri **argon2id** ile saklanır (düz metin yok).
- **Secret'lar şifreli:** Discord bot token'ı, Spotify client secret + refresh token, mail uygulama şifresi ve
  2FA secret'ları veritabanında **AES-256-GCM** ile şifrelenir (`APP_ENCRYPTION_KEY`). API yanıtlarında yalnızca
  "ayarlı mı" bilgisi döner, değerler dönmez.
- **Loglar:** `botToken`, `clientSecret`, `appPassword` gibi alanlar loglarda otomatik `[Redacted]`.
- **Oturum:** kısa ömürlü erişim token'ı + `__Host-` önekli, `HttpOnly`, `SameSite` refresh/CSRF çerezleri;
  token ailesi yeniden kullanım tespiti; 2FA (TOTP + kurtarma kodları).
- **İstek koruması:** güvenlik başlıkları (CSP, HSTS, nosniff…), origin/referer kontrolü, uca özel rate limit,
  iletişim formunda ve admin girişinde Turnstile (sunucuda Cloudflare `siteverify`, şifre kontrolünden önce). SQL yalnızca Prisma üzerinden (ham/`$queryRawUnsafe` yok).
- **Veritabanı:** geliştirmede Docker PostgreSQL yalnızca `127.0.0.1`'e bağlıdır (`127.0.0.1:5447:5432`) —
  dışarıdan/ağdan erişilemez. Mailpit de yalnızca localhost.
- **Dosya sunumu:** depo anahtarı kök dışına çıkamaz (path traversal koruması); yalnızca yayında/aktif sahibi
  olan medya public sunulur.

Ayrıntı: [SECURITY.md](docs/SECURITY.md), [RULES.md](docs/RULES.md).

---

## Public API

Tüm public GET yanıtları `Cache-Control` ile önbelleklenir (durum uçları 15 sn). Tam tablo:
[ROUTES.md §3](docs/ROUTES.md).

| Metod | Path | Açıklama |
|---|---|---|
| GET | `/api/health` · `/api/ready` | Liveness · DB ping |
| GET | `/api/public/site` | Sayfa iskeleti (tek aggregate; aşağıda) |
| GET | `/api/public/projects` · `/projects/:slug` · `/categories` | Projeler, detay, kategoriler |
| GET | `/api/public/links` | Aktif linkler |
| GET | `/api/public/wallpapers` · `/pfps` | İndirme listeleri (`?cursor=&limit=24`, keyset) |
| GET | `/api/public/downloads/:target/:publicId` | Dosya indirme (`target ∈ wallpaper, pfp`) |
| GET | `/api/public/status/:provider` | Discord / Spotify / GitHub anlık durumu |
| GET | `/api/public/status/:provider/stream` | **Canlı durum (SSE)** — snapshot değişince anında push |
| GET | `/api/public/legal/:key` | `kvkk-notice` · `cookie-policy` |
| POST | `/api/public/contact` | İletişim formu (honeypot → şema → rate limit → Turnstile) |
| POST | `/api/public/consent` · `/analytics/events` | Çerez tercihi · izinli analitik |
| GET | `/media/:assetId/:variant` | Public medya (`main, thumb, poster, v1080, v720`); Range, ETag, immutable |

**`GET /api/public/site`** tek istekte sayfanın tüm iskeletini verir: `navbarTitle`, `hero`, `today`
(rotasyon seçimleri), `about`, `footer`, `techStack`, `integrations`, `nav`, `sections`, `legal`, `captcha`,
`falling`. İçerik yoksa ilgili alan `null`/`false` döner. Secret veya admin verisi içermez.

Public kayıt şekilleri:

```text
ProjectCard   { slug, title, excerpt, cover|null, categories:[{id,name}] }
ProjectDetail { slug, title, descriptionMarkdown, images[], categories, links:{demo,video,github} }
MediaCard     { publicId, title, type, previewUrl, thumbUrl, posterUrl|null, width, height, downloadUrl }
```

---

## Admin API

`/api/admin/*` altında; hepsi `Cache-Control: no-store`. Yetki katmanları izin anahtarlarıyla
(`media:*`, `hero:*`, `settings:*`, `status:*`…); secret ve Spotify bağlama uçları yalnızca SUPER_ADMIN.
Medya içeren oluşturma/güncelleme uçları `multipart/form-data`. Tam tablo: [ROUTES.md §4](docs/ROUTES.md).

- **Auth** `/api/admin/auth` — login (+2FA), refresh (rotasyon), logout, şifre sıfırlama
- **Hesap** `/api/admin/account` — şifre/e-posta değişimi, 2FA, oturumlar, mail (SMTP) ayarları
- **Dashboard** `/api/admin/dashboard/summary` — ziyaretçi, indirme, proje, entegrasyon, depo özetleri
- **İçerik** `/api/admin/media/{backgrounds,musics,pfps,cursors,name-overlays}`, `/tech-stack` (bölümler:
  `/tech-stack/groups[/:groupId[/items]]`),
  `/falling-items`, `/projects`, `/categories`, `/links` — CRUD + sıralama + dosya değiştirme
- **Site / Hero** `/api/admin/settings`, `/api/admin/hero` — başlık, footer teknolojileri, hero alanları
- **Durumlar** `/api/admin/integrations/:provider` — aç/kapat, config, secret'lar (L5), test, senkron
- **Sistem** yasal metinler; **Audit** `/api/admin/audit-logs` (okuma, filtre, sayfalama), `/audit-logs/filters`,
  `/audit-logs/export.csv` (yalnızca SUPER_ADMIN)

**Oturum akışı:** login → access token (gövde) + refresh/CSRF çerezleri → `Authorization: Bearer` ile istek →
süre dolunca `/auth/refresh` (çerez + `X-CSRF-Token`). Yabancı origin/CSRF başarısız → 403.

---

## Yönetim paneli kullanımı

1. `/admin` adresinden giriş yap (2FA açıksa TOTP kodu). İlk hesabı `admin:dev-set` (dev) veya `admin:create`
   (prod) ile oluştur.
2. **Site Ayarları:** navbar başlığı, footer teknolojileri (React Icons adı), favicon.
3. **Hero Section:** isim, slogan, konum, isim efektleri + gradyan renkleri, profil kaynağı (rotasyon/sabit) ve
   altında **Yağan öğeler** (görsel/emoji).
4. **Medya Yönetimi:** arka planlar (duvar kağıdı bayrağı dahil), müzikler, profil fotoğrafları, cursor setleri,
   isim efektleri (GIF); her biri Aktif/Rotasyon anahtarlı. Kütüphane sekmesinde proje/link/Tech Stack görselleri
   ve depo kullanımı.
5. **Durumlar:** Discord (bot token, kullanıcı ID, hitap şekli), Spotify (bağlan), GitHub (kullanıcı adı); test
   ve "Şimdi senkronize et".
6. **Projeler / Kategoriler / Linkler:** içerik CRUD'u.
7. **Tech Stack:** üstteki sekmelerde bölümler ("My Tech Stack", "My Security Skill"…). **Yeni bölüm ekle**
   ayrı bir halka açar (varsayılan başlık "My Security Skill", yayında değil başlar). Her bölümde başlık (3
   satır), yayın anahtarı (en az 3 aktif öğe), öğeler (görsel, etiket, açıklama, sürükle-bırak sıra), canlı
   önizleme, öne/sona alma ve bölümü silme. En fazla 6 bölüm, bölüm başına 9 öğe.
8. **İletişim Mesajları, Hesap Ayarları (2FA, mail), Sistem (yasal metinler), Loglar.**

Rol matrisi ve izinler: [ADMIN.md](docs/ADMIN.md).

---

## Medya hattı

- Görseller EXIF/metadata temizlenip **WebP**'ye çevrilir (+ thumbnail, gerekiyorsa poster). Animasyonlu GIF
  korunur.
- Videolar **H.264 MP4** + faststart, sessiz, ≤ 30 fps. **Arka plan videoları** ayrıca ekrana göre
  **4K ana kopya + 1080p + 720p** oynatma kopyaları üretir; tarayıcı ekranına uygun olanı seçer, indirme ve
  büyük ekranlar ana kopyayı alır. Video admin yüklemesinden sonra iş kuyruğunda işlenir (ziyaretçi beklemez).
- Aynı dosya iki kez yüklenince hash ile tespit edilip uyarılır. Silinen medyanın tüm varyantları silme
  kuyruğuna yazılıp diskten temizlenir.

Ayrıntı: [CMS.md](docs/CMS.md), [DATABASE.md](docs/DATABASE.md).

---

## Entegrasyonlar

- **Discord:** `discord.js` botu Gateway'e bağlanır; hedef kullanıcı botla ortak sunucuda olmalı. Avatar,
  dekorasyon, banner, vurgu rengi, herkese açık rozetler, sunucu etiketi, isim plakası, tüm etkinlikler (oyun,
  Spotify, yayın, izleme) ve ses kanalı çekilir. Hitap şekli admin'den elle girilir (bot API'si vermez). Profil
  efekti, isim stili ve Nitro/görev rozetleri bot API'sinde yoktur.
- **Spotify:** OAuth ile bağlanır (refresh token şifreli saklanır). Çalarken 10 sn'de bir, çalmıyorken 60 sn'de
  bir sorulur; değişim SSE ile anında siteye yansır. Yerel test için Spotify `127.0.0.1` yönlendirmesi kabul
  eder (`localhost` etmez).
- **GitHub:** kullanıcı adıyla istatistik/streak kartları (SVG) proxy'lenir.

Ziyaretçi isteği hiçbir zaman dış API çağrısı tetiklemez; yalnızca sunucuda saklanan snapshot okunur.

---

## Üretime dağıtım

`deploy/` altında Caddyfile (TLS + güvenlik başlıkları + SSE flush), systemd servisi, deploy/backup/smoke
betikleri ve crontab vardır. Adım adım kurulum, ilk admin, cron/rotasyon, yedekleme ve izleme:
[DEPLOY.md](docs/DEPLOY.md).

---

## Dokümanlar

| Konu | Doküman |
|---|---|
| Ürün ve gereksinimler | [PRD.md](docs/PRD.md), [SRS.md](docs/SRS.md) |
| Mimari, ortam değişkenleri | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Veritabanı, şema, yedekleme | [DATABASE.md](docs/DATABASE.md), [ERD.md](docs/ERD.md) · migration'lar `backend/prisma/migrations` |
| API uçları | [ROUTES.md](docs/ROUTES.md) |
| Admin paneli, ilk kurulum, hesap kurtarma | [ADMIN.md](docs/ADMIN.md), [DEPLOY.md §5](docs/DEPLOY.md) |
| İçerik, şablonlar, medya kuralları | [CMS.md](docs/CMS.md) |
| Üretime dağıtım, cron/rotasyon, izleme, yedek | [DEPLOY.md](docs/DEPLOY.md) |
| Güvenlik kontrolleri | [SECURITY.md](docs/SECURITY.md), [RULES.md](docs/RULES.md) |

Gerçek secret'lar hiçbir dokümanda ve kaynak kodda yoktur; örnekler `backend/.env.example` ve
`backend/.env.production.example`.
