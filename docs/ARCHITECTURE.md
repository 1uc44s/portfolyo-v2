# ARCHITECTURE — Sistem Mimarisi

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Bağlı: SRS.md, DATABASE.md, ROUTES.md

---

## 1. Üst düzey görünüm

```mermaid
flowchart LR
    subgraph Client[Tarayıcı]
        SPA[React SPA<br/>public + admin lazy chunk]
        AUD[(Tek global audio)]
        LS[(localStorage<br/>tema, ses, consent)]
    end
    subgraph Edge[Reverse proxy - Caddy]
        TLS[TLS + HTTP/2 + brotli]
    end
    subgraph App[Node 24 - Express 5]
        API[/REST API/]
        MED[/Medya sunucu<br/>Range, ETag/]
        WRK[Worker'lar<br/>medya kuyruğu, dosya silme,<br/>entegrasyon poller, cron]
        DBOT[Discord Gateway<br/>istemcisi]
    end
    PG[(PostgreSQL 17)]
    ST[(Kalıcı disk / S3)]
    EXT{{Spotify · GitHub · Stats · SMTP · Turnstile}}

    SPA -->|HTTPS| TLS --> API
    TLS --> MED
    TLS -->|/ statik| SPA
    API --> PG
    MED --> ST
    WRK --> PG
    WRK --> ST
    WRK --> EXT
    DBOT --> PG
```

**Süreç modeli (v1):** Tek Node süreci; API ve worker'lar aynı süreçte, ayrı modüller olarak çalışır. Tek instance varsayımı: bellek içi rate limit ve cache. Ölçekleme gerekirse §9'daki ayrıştırma uygulanır.

---

## 2. Monorepo dizin mimarisi

npm workspaces kullanılır. Tüm kaynak **JavaScript (ESM) / JSX**; TypeScript dosyası bulunmaz.

```text
vasquez-portfolyo/
├─ docs/                          # Single Source of Truth (bu dosyalar)
├─ package.json                   # workspaces: ["frontend","backend","packages/*"]
├─ .editorconfig  .prettierrc  eslint.config.js  .nvmrc (24)
├─ .env.example                   # kök: docker-compose değişkenleri
├─ docker-compose.yml             # postgres:17 (+ mailpit dev)
├─ Caddyfile.example
├─ packages/
│  └─ shared/                     # frontend + backend ortak
│     ├─ package.json             # "name": "@vasquez/shared", "type": "module"
│     └─ src/
│        ├─ constants/            # enum yansımaları, limitler, permission anahtarları
│        ├─ validation/           # Zod şemaları (link, project, contact, auth, media...)
│        │  └─ url.js             # httpUrl() — SEC-12
│        └─ text/                 # normalizeKey, slugify sarmalayıcı
├─ backend/
│  ├─ package.json                # "type": "module"
│  ├─ .env.example
│  ├─ prisma.config.mjs           # Prisma 7: datasource url, migration yolu, seed komutu
│  ├─ vitest.config.js            # test DB (…_test) türetme + globalSetup
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.mjs                 # yalnızca sistem kayıtları
│  ├─ scripts/
│  │  ├─ admin-create.mjs         # ilk kurulum CLI (FR-SETUP)
│  │  ├─ admin-reset-password.mjs # SMTP yokken kurtarma (ADMIN.md §2.3)
│  │  ├─ admin-reset-2fa.mjs
│  │  ├─ admin-unlock.mjs
│  │  └─ rotation-run.mjs         # manuel tetik/test
│  ├─ uploads/                    # DEV deposu (gitignore) — prod'da STORAGE_ROOT
│  │  ├─ bg/  musics/  pfps/  cursors/  projects/  links/  favicons/
│  │  ├─ thumbnails/  posters/
│  │  └─ tmp/
│  ├─ src/
│  │  ├─ server.js                # bootstrap, graceful shutdown
│  │  ├─ app.js                   # express app (test edilebilir, listen yok)
│  │  ├─ config/env.js            # Zod ile env doğrulama (eksikse başlamaz)
│  │  ├─ lib/
│  │  │  ├─ prisma.js  logger.js  crypto.js (AES-GCM)  hash.js (sha256, hmac)
│  │  │  ├─ time.js               # Europe/Istanbul gün hesapları
│  │  │  ├─ httpError.js          # AppError sınıfları
│  │  │  └─ cache.js              # TTL bellek cache
│  │  ├─ middleware/
│  │  │  ├─ requestId.js  securityHeaders.js  cors.js  originCheck.js
│  │  │  ├─ rateLimit.js  validate.js  requireAuth.js  requirePermission.js
│  │  │  ├─ passwordGate.js  csrf.js  noStore.js  auditContext.js
│  │  │  └─ errorHandler.js  notFound.js
│  │  ├─ modules/                 # özellik bazlı dikey dilimler
│  │  │  ├─ auth/                 # routes.js controller.js service.js tokens.js totp.js
│  │  │  ├─ account/
│  │  │  ├─ admins/               # EDITOR yönetimi (opsiyonel faz)
│  │  │  ├─ settings/             # site, hero, about, legal, templates
│  │  │  ├─ media/                # upload, pipeline, serve, library
│  │  │  ├─ backgrounds/ musics/ profile-media/ cursors/
│  │  │  ├─ rotation/             # service.js (selectForDate), cron.js
│  │  │  ├─ projects/ categories/ links/
│  │  │  ├─ integrations/         # discord/ spotify/ github/ ortak poller
│  │  │  ├─ contact/
│  │  │  ├─ downloads/ analytics/ consent/
│  │  │  ├─ dashboard/
│  │  │  ├─ audit/
│  │  │  └─ public/               # public okuma uçları (site aggregate)
│  │  ├─ storage/
│  │  │  ├─ index.js              # driver seçimi (local | s3)
│  │  │  ├─ local.js  s3.js
│  │  ├─ jobs/
│  │  │  ├─ scheduler.js          # tüm cron kayıtları tek yerde
│  │  │  ├─ mediaQueue.js         # DB tabanlı iş kuyruğu (processingStatus)
│  │  │  ├─ storageGc.js  retention.js  dailySalt.js
│  │  └─ mail/
│  │     ├─ transport.js  templateEngine.js
│  └─ test/                       # vitest + supertest
├─ frontend/
│  ├─ package.json  vite.config.js  components.json (tsx:false)  jsconfig.json (@/ alias)
│  ├─ index.html                  # tema init inline script (CSP hash)
│  ├─ public/                     # varsayılan favicon, robots.txt
│  └─ src/
│     ├─ main.jsx                 # QueryClient, Router, providers
│     ├─ app/
│     │  ├─ AppShell.jsx          # GlobalAudio + SceneLayer + Cursor + Toaster + <Routes>
│     │  ├─ routes.jsx            # public route'lar + lazy admin
│     │  └─ providers/            # ThemeProvider, EffectsProvider, ConsentProvider
│     ├─ styles/
│     │  ├─ globals.css           # @import "tailwindcss"; @theme token'ları
│     │  └─ fonts.css             # @fontsource-variable/* self-host
│     ├─ components/
│     │  ├─ ui/                   # shadcn (JSX) — elle düzenlenebilir
│     │  ├─ common/               # Skeleton varyantları, EmptyState, ErrorState, ExternalLink, SafeMarkdown
│     │  └─ media/                # SmartMedia (img/gif/video kararı), Lightbox
│     ├─ features/
│     │  ├─ scene/                # SceneLayer (arka plan, örtü yok), CursorManager
│     │  ├─ player/               # store.js (Zustand), GlobalAudio.jsx, PlayerBar.jsx
│     │  ├─ welcome/              # WelcomeOverlay.jsx
│     │  ├─ hero/                 # Hero.jsx, effects/ (Neon, Gradient, Particles, Stars)
│     │  ├─ status/               # DiscordCard, SpotifyCard, GithubCard
│     │  ├─ techstack/            # TechStackPlaceholder.jsx
│     │  ├─ projects/  about/  links/  contact/
│     │  ├─ downloads/            # DownloadGrid, DisclaimerDialog (wallpapers + pfps ortak)
│     │  ├─ consent/              # CookieBanner, PreferencesDialog
│     │  └─ layout/               # PublicLayout, Navbar, Footer, MobileNav
│     ├─ pages/                   # route seviyesinde ince bileşenler
│     │  ├─ HomePage.jsx  WallpapersPage.jsx  PfpsPage.jsx  ProjectDetailPage.jsx
│     │  ├─ LegalPage.jsx  NotFoundPage.jsx
│     ├─ admin/                   # TAMAMI lazy chunk
│     │  ├─ AdminApp.jsx  AdminLayout.jsx  Sidebar.jsx  Topbar.jsx
│     │  ├─ auth/                 # LoginPage, TwoFactorPage, ForgotPage, ResetPage, ChangePasswordPage
│     │  ├─ pages/                # her menü öğesi için klasör
│     │  └─ components/           # DataTable, UploadField(progress), SortableList, FormSection
│     ├─ lib/
│     │  ├─ api/                  # client.js (axios), publicApi.js, adminApi.js, queryKeys.js
│     │  ├─ auth/                 # authStore.js (access token bellekte), refresh kuyruğu
│     │  ├─ prefs.js              # localStorage güvenli okuma/yazma
│     │  └─ format.js             # süre, tarih (tr-TR), byte
│     └─ hooks/                   # useReducedEffects, useInView, useMediaQuery
└─ e2e/                           # Playwright testleri
```

### 2.1 Katman kuralları

- **Backend modül içi akış:** `routes.js` (path + middleware zinciri) → `controller.js` (HTTP ↔ servis çevirisi; req/res yalnızca burada) → `service.js` (iş kuralı, transaction) → Prisma. Servisler HTTP bilmez; test edilebilir saf fonksiyonlardır.
- Modüller arası çağrı yalnızca servis üzerinden (`import { reselectToday } from '../rotation/service.js'`); başka modülün controller/route'u import edilmez.
- **Frontend:** `pages/` ince; iş mantığı `features/`. Sunucu durumu TanStack Query'de, istemci durumu Zustand'da; ikisi karıştırılmaz.
- `packages/shared` hiçbir Node veya DOM API'sine bağımlı olamaz (iki tarafta da çalışmalı).

---

## 3. İstek yaşam döngüsü (backend middleware zinciri)

```text
gelen istek
 → requestId            (X-Request-Id)
 → pino-http            (redaction)
 → securityHeaders      (helmet + CSP)
 → cors                 (yalnızca dev/izinli origin)
 → compression          (proxy yoksa)
 → globalRateLimit      (public 300/dk/IP)
 → express.json({limit:'100kb'}) / cookieParser
 → originCheck          (state-changing metodlarda Origin/Referer == PUBLIC_ORIGIN)
 ┌ /api/public/*  → [endpoint rate limit] → validate(zod) → controller
 ├ /media/*       → mediaServe (yalnızca public-görünür asset)
 └ /api/admin/*   → noStore
                  → /auth/* (login, refresh, logout, forgot, reset, 2fa) özel zincir
                  → requireAuth (Bearer JWT doğrula, oturum canlı mı)
                  → passwordGate (mustChangePassword)
                  → requirePermission('<modül>:<eylem>')
                  → validate(zod)  → controller → service → audit.write()
 → notFound
 → errorHandler        (AppError → standart yanıt; bilinmeyen → 500, stack loglanır, istemciye verilmez)
```

---

## 4. Kimlik doğrulama akışı

### 4.1 Token modeli

| Token | Biçim | Ömür | Saklama (istemci) | Saklama (sunucu) |
|---|---|---|---|---|
| Access | JWT HS256 (`JWT_ACCESS_SECRET`) | 15 dk | Yalnızca bellek (Zustand) | — (stateless; `sid` ile oturum canlılığı kontrol edilir) |
| Refresh | 32 byte rastgele (base64url) | 7 gün (remember) / 12 saat (oturum) | `__Host-rt` HttpOnly Secure SameSite=Strict cookie | `AdminSession.refreshTokenHash` (SHA-256) |
| CSRF | `base64url(HMAC-SHA256(CSRF_SECRET, sessionId))` — oturuma bağlı, saklanmaz | refresh ile aynı (her rotasyonda yenilenir) | `__Host-csrf` cookie (HttpOnly **değil**, JS okur) + `X-CSRF-Token` header | Saklanmaz; istek anında refresh cookie'sinden bulunan `sessionId` ile yeniden hesaplanıp header ve cookie ile karşılaştırılır |
| MFA ara token | JWT (`aud: 'mfa'`) | 5 dk | Bellek | — |

`requireAuth`, JWT doğrulandıktan sonra `sid`'i bellek cache'li (30 sn TTL) bir sorgu ile kontrol eder: oturum iptal edildiyse 401. Böylece "oturumu sonlandır" en geç 30 sn içinde etkili olur.

**Uygulama notları (F3):**
- JWT `sid` = oturum **ailesinin** kimliği (`familyId`), satır kimliği değil. Canlılık = ailenin iptal edilmemiş, döndürülmemiş ve süresi dolmamış baş satırı var mı. Refresh rotasyonu aileyi değiştirmediği için mevcut access token'lar 15 dk ömürleri boyunca geçerli kalır; aile iptali hepsini aynı anda geçersiz kılar.
- Önbellek aynı süreçte iptal anında temizlenir (`invalidateFamilyCache`); yönetici alanı değiştiğinde (şifre, e-posta, 2FA, profil) o yöneticinin tüm önbellek girdileri düşürülür (`invalidateAdminCache`) ki `mustChangePassword` gibi bayraklar bayat kalmasın. Çoklu instance'ta diğer süreçler için üst sınır 30 sn TTL'dir.
- CSRF token'ı satır kimliğine bağlıdır (her rotasyonda değişir). Reuse tespiti CSRF kontrolünden **önce** yapılır: döndürülmüş token gelirse aile koşulsuz iptal edilir.
- Hesap Ayarları > Oturumlar listesindeki `id` de `familyId`'dir.
- Rate limiter'lar `createApp` başına oluşturulur (bellek içi); e-posta bazlı giriş sayacı başarılı girişte sıfırlanır.

### 4.2 Login + 2FA

```mermaid
sequenceDiagram
    autonumber
    participant B as Tarayıcı
    participant A as API
    participant D as DB
    B->>A: POST /api/admin/auth/login {email, password, rememberMe}
    A->>A: rate limit (IP + email)
    A->>D: AdminUser bul (yoksa dummy argon2 verify)
    A->>A: argon2.verify, kilit kontrolü
    alt Şifre hatalı
        A->>D: failedLoginCount++, gerekirse lockedUntil
        A-->>B: 401 INVALID_CREDENTIALS (genel mesaj)
    else 2FA açık
        A-->>B: 200 {mfaRequired:true, mfaToken}
        B->>A: POST /auth/2fa/verify {mfaToken, code}
        A->>A: TOTP doğrula (+lastTotpStep replay)
    end
    A->>D: AdminSession oluştur (familyId yeni, hash(refresh))
    A->>D: failedLoginCount=0, lastLoginAt, audit AUTH_LOGIN_SUCCESS
    A-->>B: 200 {accessToken, admin} + Set-Cookie __Host-rt, __Host-csrf
```

### 4.3 Refresh rotasyonu ve reuse tespiti

```mermaid
sequenceDiagram
    autonumber
    participant B as Tarayıcı
    participant A as API
    participant D as DB
    B->>A: POST /auth/refresh (cookie rt) + X-CSRF-Token
    A->>A: Origin + CSRF doğrula
    A->>D: session = find(refreshTokenHash)
    alt Bulunamadı / süresi dolmuş / revoked
        A-->>B: 401 + cookie sil
    else session.rotatedAt != null (REUSE)
        A->>D: familyId'deki tüm oturumları revoke(REUSE)
        A->>D: audit SESSION_REUSE_DETECTED
        A-->>B: 401 + cookie sil
    else Geçerli
        A->>D: updateMany(id, rotatedAt:null) → rotatedAt=now (count==1 şartı)
        A->>D: yeni session (aynı familyId, aynı rememberMe, expiresAt korunur*)
        A-->>B: 200 {accessToken} + yeni rt, csrf cookie
    end
```

\* Mutlak ömür korunur: yeni oturumun `expiresAt` değeri ailenin ilk oturumunun bitişini aşamaz (7 gün "kayan" değil, sabit pencere).

### 4.4 İstemci tarafı token yönetimi

- Uygulama açılışında admin route'una girilirse `POST /auth/refresh` sessizce denenir (cookie varsa oturum geri gelir).
- axios interceptor: `401 TOKEN_EXPIRED` → tek bir refresh isteği (eşzamanlı istekler kuyrukta bekler) → orijinal isteği yeniden dene. Refresh başarısızsa auth store temizlenir, `/admin/login?next=...`.
- Birden fazla sekme: `BroadcastChannel('auth')` ile logout ve yeni access token paylaşılır; aynı anda iki sekmenin refresh yapıp reuse tetiklemesi `navigator.locks.request('auth-refresh')` ile engellenir.
- Access token hiçbir zaman `localStorage`/`sessionStorage`'a yazılmaz.

### 4.5 Şifre sıfırlama

```text
POST /auth/forgot-password {email}
  → her durumda 202 (sabit gecikme ~400 ms + jitter)
  → hesap var + SMTP hazır: token üret, eski aktif token'ları usedAt=now, hash kaydet,
    PASSWORD_RESET şablonuyla e-posta: {PUBLIC_ORIGIN}/admin/reset-password#token=<token>
    (token URL fragment'ında → sunucu loglarına ve Referer'a düşmez)
POST /auth/reset-password {token, newPassword}
  → hash ile bul, süre/kullanım kontrolü → şifre güncelle → tüm oturumları revoke(PASSWORD_CHANGE)
  → usedAt=now → audit PASSWORD_RESET_COMPLETED → 200 (otomatik login YOK)
```

---

## 5. Public site çalışma zamanı

### 5.1 Uygulama kabuğu

```jsx
<QueryClientProvider>
  <ThemeProvider> <EffectsProvider> <ConsentProvider>
    <BrowserRouter>
      <AppShell>              // router'ın üstünde kalıcı katmanlar
        <SceneLayer />        // günlük arka plan, örtüsüz (public route'larda)
        <CursorManager />     // günlük cursor seti (public route'larda, pointer:fine)
        <GlobalAudio />       // TEK <audio> — hiç unmount olmaz
        <Routes>…</Routes>    // PublicLayout(Navbar, Outlet, PlayerBar, Footer) | AdminApp(lazy)
        <Toaster />  <CookieBanner />
      </AppShell>
    </BrowserRouter>
  </ConsentProvider> </EffectsProvider> </ThemeProvider>
</QueryClientProvider>
```

- `GlobalAudio` router dışında olduğu için route değişimi `<audio>`'yu yeniden oluşturmaz (FR-PLY-01). `PlayerBar` yalnızca kontrol arayüzüdür; store üzerinden `<audio>` ref'ine komut gönderir.
- Admin route'larına girildiğinde müzik **duraklatılmaz** (kullanıcı kontrolünde kalır) ama `SceneLayer` ve `CursorManager` admin'de devre dışıdır.

### 5.2 Veri yükleme sırası

1. `GET /api/public/site` (tek aggregate, kritik yol): ayarlar, hero, günlük seçimler (bg, müzik, pfp, cursor — URL'leriyle), nav bayrakları, footer, about, legal sürümü, entegrasyon açık/kapalı bayrakları.
2. Paralel, kritik olmayan: `/api/public/projects`, `/api/public/links`, `/api/public/status/*`.
3. Arka plan medyası: önce poster/thumbnail (LCP adayı değil — hero metni LCP'dir), sonra koşullar uygunsa video.

### 5.3 Tema/efekt boot sırası

```text
index.html <head>:
  inline script (CSP hash'li):
    prefs = safeParse(localStorage)
    html.dataset.theme   = prefs.theme ?? (matchMedia dark ? 'dark' : 'light')
    html.dataset.surface = prefs.surface ?? 'glass'
    html.dataset.effects = prefs.effects ?? (matchMedia reduced-motion ? 'low' : 'full')
  → CSS token'ları [data-theme], [data-surface], [data-effects] seçicileriyle çözülür
  → React mount olur, ThemeProvider aynı değerleri state'e alır
```

### 5.4 Cursor yönetimi

- `@media (pointer: fine)` ve `effects` ne olursa olsun uygulanır (cursor performans sorunu yaratmaz); `pointer: coarse` cihazlarda uygulanmaz.
- `html { cursor: url(normal) hx hy, auto }`; `pointerdown` → `html.dataset.pressed = 'true'` → `cursor: url(click) hx hy, auto`; `pointerup/pointercancel/blur` → kaldır.
- Tıklanabilir öğelerde (`a, button, [role=button]`) aynı set kullanılır (ayrı "pointer" imleci yok; set iki dosyadan oluşur).
- Dosya yüklenemezse CSS fallback `auto` devreye girer.

---

## 6. PWA yaşam döngüsü (OPSİYONEL — Faz 17)

Şartnamede PWA yoktur; doküman şablonunun beklentisi nedeniyle **opsiyonel** olarak tanımlanmıştır. Aktive edilirse kurallar:

### 6.1 Kapsam
- `vite-plugin-pwa` (`registerType: 'prompt'`, `injectManifest` yerine `generateSW`).
- Manifest: `name` = navbarTitle (build-time varsayılan), `display: standalone`, `theme_color` = tema token'ı, ikonlar 192/512 + maskable.
- Yalnızca **public uygulama kabuğu** (HTML, JS, CSS, fontlar) önbelleğe alınır.

### 6.2 Önbelleğe alınmayanlar (NetworkOnly)
- `/api/admin/*`, `/api/public/*` (canlı veri; offline'da son başarılı yanıt gösterilmez — tutarlılık için), `/media/*` (büyük dosyalar ve Range istekleri SW ile uyumsuz), `/api/public/downloads/*`.
- Admin route'ları SW navigation fallback'inden hariç (`navigateFallbackDenylist: [/^\/admin/, /^\/api/, /^\/media/]`).

### 6.3 Yaşam döngüsü
| Olay | Davranış |
|---|---|
| install | Precache manifest'teki kabuk dosyaları |
| waiting | Yeni sürüm varsa "Yeni sürüm hazır — Yenile" toast'ı |
| activate | Kullanıcı onayıyla `skipWaiting` + `clientsClaim`; eski cache'ler silinir |
| offline navigasyon | `offline.html` (marka uyumlu, "Bağlantı yok") |
| güncelleme kontrolü | Sayfa görünür olduğunda saatte bir `registration.update()` |

Müzik çalarken SW güncellemesi otomatik sayfa yenilemesi **yapmaz** (FR-PLY ile çakışmamak için yalnızca prompt).

---

## 7. Oturum yönetimi (admin)

| Konu | Karar |
|---|---|
| Eşzamanlı oturum | Sınırsız; Hesap Ayarları'nda listelenir |
| Mutlak ömür | remember: 7 gün; değilse 12 saat (sabit pencere) |
| Boşta kalma | 12 saatlik oturumda 2 saat refresh yoksa geçersiz (`lastUsedAt` kontrolü) |
| Şifre değişimi | Mevcut oturum hariç tüm oturumlar revoke |
| Şifre sıfırlama | Tüm oturumlar revoke |
| 2FA kapatma/açma | Mevcut hariç tüm oturumlar revoke |
| Rol/yetki değişimi | Hedef kullanıcının tüm oturumları revoke (yeni yetkiler yeni JWT'de) |
| Hesap pasife alma | Tüm oturumlar revoke; login reddedilir |
| Reuse tespiti | Aile revoke + audit + (SMTP varsa) güvenlik e-postası |
| Temizlik | Süresi dolmuş/iptal oturumlar 30 gün sonra silinir |

---

## 8. Medya hattı

```mermaid
flowchart TD
    U[Admin upload<br/>axios onUploadProgress] --> M[multer diskStorage → uploads/tmp<br/>limits.fileSize türe göre]
    M --> V{Doğrulama<br/>uzantı · file-type magic · MIME eşleşme}
    V -- hata --> X[tmp sil · 415/422]
    V -- ok --> T{Tür}
    T -- statik görsel --> S[Sharp: rotate · strip metadata · WebP ana + thumb]
    T -- GIF --> G[Koru · thumb ilk kare]
    T -- cursor/favicon --> C[Boyut kontrolü · olduğu gibi]
    T -- MP3 --> A[music-metadata süre · ffmpeg -map_metadata -1]
    T -- video --> Q[MediaAsset PENDING · mediaQueue]
    Q --> F[FFmpeg H.264 + faststart · poster · thumb]
    S & G & C & A & F --> W[storage.put → kalıcı anahtar<br/>uuid.ext]
    W --> R[MediaAsset READY · tmp sil]
    R --> O[Sahip kayıt bağlanır<br/>Background/Music/...]
```

- **Upload API iki adımlı değildir:** her içerik oluşturma endpoint'i (ör. `POST /api/admin/media/backgrounds`) `multipart` olarak hem dosyayı hem alanları alır. Video için yanıt `202` + kayıt `processingStatus: PENDING`; admin listesi PENDING/PROCESSING kayıtları 3 sn aralıkla yeniden çeker.
- PENDING/FAILED medyalı içerik public'te görünmez (`processingStatus = READY` şartı).
- `mediaQueue`: DB tabanlı (PENDING kayıtları `FOR UPDATE SKIP LOCKED` ile alır), eşzamanlılık 1, açılışta PROCESSING kalmış işleri PENDING'e çevirir.
- **Sunum (`/media/:assetId/:variant`):** `variant ∈ {main, thumb, poster}`. Asset'in public-görünür bir sahibi yoksa 404 (admin önizlemesi `/api/admin/media/:id/file/:variant` üzerinden yetkili). Range, ETag, `immutable` cache.
- **İndirme (`/api/public/downloads/:target/:publicId`):** yalnızca aktif + indirilebilir + READY; `downloadKey ?? storageKey` sunulur; sayaç §SRS FR-DSH-04.

- **Uygulama (F6):** `modules/media/` — `validate.js` (FR-MED-02 zinciri), `process.js` (Sharp/GIF/ikon/MP3), `formats.js` (yeniden kodlamasız metadata temizliği), `ffmpeg.js` (`spawn`, `shell: false`, 10 dk timeout), `service.js` (`ingestUpload`, SHA-256 tekrar uyarısı, koşullu silme), `library.js` (kullanım/görünürlük), `serve.js`, `upload.js` (multer). İşler `jobs/mediaQueue.js`, `jobs/storageGc.js`, `jobs/tmpCleanup.js`, `jobs/scheduler.js` (`server.js` başlatır; testlerde çalışmaz).
- **Video kaynağı:** yüklemede `tmp/queue/<assetId>.mp4` anahtarına taşınır, anahtar `MediaAsset.metadata.sourceKey`'de tutulur; iş bitince (READY/FAILED) silinir.
- **Silme yarışı:** asset silme `deleteMany({ id, ...ORPHAN_WHERE })` ile yapılır — arada sahip bağlanırsa silinmez (409). Çoklu ilişki `include`'u interaktif transaction içinde kullanılmaz (adapter-pg paralel sorgu uyarısı).
- **Sunum ayrıntısı:** `/media` router'ı `compression`'dan önce bağlanır (Range yanıtı sıkıştırılmaz); rate limit uygulanmaz. Public `Cache-Control: public, max-age=31536000, immutable`, admin önizleme `private, no-store`. Tek aralıklı Range (206), aralık dışı 416, `If-None-Match` → 304.

### 8.1 Storage soyutlaması

```js
// storage/index.js arayüzü (local ve s3 aynı imza)
put(tmpPath, key, { contentType })   // atomik: önce .partial, sonra rename
createReadStream(key, { start, end })
stat(key)                            // { size, mtime }
remove(key)
resolveUrl?                          // S3'te imzalı URL (opsiyonel)
```

`local.js`: `STORAGE_ROOT` altında (göreli değer `backend/` dizinine göre çözülür); anahtar `^[a-z0-9-]+(/[a-z0-9-]+)*/[A-Za-z0-9-]+.[a-z0-9]{2,5}# ARCHITECTURE — Sistem Mimarisi

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Bağlı: SRS.md, DATABASE.md, ROUTES.md

---

## 1. Üst düzey görünüm

```mermaid
flowchart LR
    subgraph Client[Tarayıcı]
        SPA[React SPA<br/>public + admin lazy chunk]
        AUD[(Tek global audio)]
        LS[(localStorage<br/>tema, ses, consent)]
    end
    subgraph Edge[Reverse proxy - Caddy]
        TLS[TLS + HTTP/2 + brotli]
    end
    subgraph App[Node 24 - Express 5]
        API[/REST API/]
        MED[/Medya sunucu<br/>Range, ETag/]
        WRK[Worker'lar<br/>medya kuyruğu, dosya silme,<br/>entegrasyon poller, cron]
        DBOT[Discord Gateway<br/>istemcisi]
    end
    PG[(PostgreSQL 17)]
    ST[(Kalıcı disk / S3)]
    EXT{{Spotify · GitHub · Stats · SMTP · Turnstile}}

    SPA -->|HTTPS| TLS --> API
    TLS --> MED
    TLS -->|/ statik| SPA
    API --> PG
    MED --> ST
    WRK --> PG
    WRK --> ST
    WRK --> EXT
    DBOT --> PG
```

**Süreç modeli (v1):** Tek Node süreci; API ve worker'lar aynı süreçte, ayrı modüller olarak çalışır. Tek instance varsayımı: bellek içi rate limit ve cache. Ölçekleme gerekirse §9'daki ayrıştırma uygulanır.

---

## 2. Monorepo dizin mimarisi

npm workspaces kullanılır. Tüm kaynak **JavaScript (ESM) / JSX**; TypeScript dosyası bulunmaz.

```text
vasquez-portfolyo/
├─ docs/                          # Single Source of Truth (bu dosyalar)
├─ package.json                   # workspaces: ["frontend","backend","packages/*"]
├─ .editorconfig  .prettierrc  eslint.config.js  .nvmrc (24)
├─ .env.example                   # kök: docker-compose değişkenleri
├─ docker-compose.yml             # postgres:17 (+ mailpit dev)
├─ Caddyfile.example
├─ packages/
│  └─ shared/                     # frontend + backend ortak
│     ├─ package.json             # "name": "@vasquez/shared", "type": "module"
│     └─ src/
│        ├─ constants/            # enum yansımaları, limitler, permission anahtarları
│        ├─ validation/           # Zod şemaları (link, project, contact, auth, media...)
│        │  └─ url.js             # httpUrl() — SEC-12
│        └─ text/                 # normalizeKey, slugify sarmalayıcı
├─ backend/
│  ├─ package.json                # "type": "module"
│  ├─ .env.example
│  ├─ prisma.config.mjs           # Prisma 7: datasource url, migration yolu, seed komutu
│  ├─ vitest.config.js            # test DB (…_test) türetme + globalSetup
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.mjs                 # yalnızca sistem kayıtları
│  ├─ scripts/
│  │  ├─ admin-create.mjs         # ilk kurulum CLI (FR-SETUP)
│  │  ├─ admin-reset-password.mjs # SMTP yokken kurtarma (ADMIN.md §2.3)
│  │  ├─ admin-reset-2fa.mjs
│  │  ├─ admin-unlock.mjs
│  │  └─ rotation-run.mjs         # manuel tetik/test
│  ├─ uploads/                    # DEV deposu (gitignore) — prod'da STORAGE_ROOT
│  │  ├─ bg/  musics/  pfps/  cursors/  projects/  links/  favicons/
│  │  ├─ thumbnails/  posters/
│  │  └─ tmp/
│  ├─ src/
│  │  ├─ server.js                # bootstrap, graceful shutdown
│  │  ├─ app.js                   # express app (test edilebilir, listen yok)
│  │  ├─ config/env.js            # Zod ile env doğrulama (eksikse başlamaz)
│  │  ├─ lib/
│  │  │  ├─ prisma.js  logger.js  crypto.js (AES-GCM)  hash.js (sha256, hmac)
│  │  │  ├─ time.js               # Europe/Istanbul gün hesapları
│  │  │  ├─ httpError.js          # AppError sınıfları
│  │  │  └─ cache.js              # TTL bellek cache
│  │  ├─ middleware/
│  │  │  ├─ requestId.js  securityHeaders.js  cors.js  originCheck.js
│  │  │  ├─ rateLimit.js  validate.js  requireAuth.js  requirePermission.js
│  │  │  ├─ passwordGate.js  csrf.js  noStore.js  auditContext.js
│  │  │  └─ errorHandler.js  notFound.js
│  │  ├─ modules/                 # özellik bazlı dikey dilimler
│  │  │  ├─ auth/                 # routes.js controller.js service.js tokens.js totp.js
│  │  │  ├─ account/
│  │  │  ├─ admins/               # EDITOR yönetimi (opsiyonel faz)
│  │  │  ├─ settings/             # site, hero, about, legal, templates
│  │  │  ├─ media/                # upload, pipeline, serve, library
│  │  │  ├─ backgrounds/ musics/ profile-media/ cursors/
│  │  │  ├─ rotation/             # service.js (selectForDate), cron.js
│  │  │  ├─ projects/ categories/ links/
│  │  │  ├─ integrations/         # discord/ spotify/ github/ ortak poller
│  │  │  ├─ contact/
│  │  │  ├─ downloads/ analytics/ consent/
│  │  │  ├─ dashboard/
│  │  │  ├─ audit/
│  │  │  └─ public/               # public okuma uçları (site aggregate)
│  │  ├─ storage/
│  │  │  ├─ index.js              # driver seçimi (local | s3)
│  │  │  ├─ local.js  s3.js
│  │  ├─ jobs/
│  │  │  ├─ scheduler.js          # tüm cron kayıtları tek yerde
│  │  │  ├─ mediaQueue.js         # DB tabanlı iş kuyruğu (processingStatus)
│  │  │  ├─ storageGc.js  retention.js  dailySalt.js
│  │  └─ mail/
│  │     ├─ transport.js  templateEngine.js
│  └─ test/                       # vitest + supertest
├─ frontend/
│  ├─ package.json  vite.config.js  components.json (tsx:false)  jsconfig.json (@/ alias)
│  ├─ index.html                  # tema init inline script (CSP hash)
│  ├─ public/                     # varsayılan favicon, robots.txt
│  └─ src/
│     ├─ main.jsx                 # QueryClient, Router, providers
│     ├─ app/
│     │  ├─ AppShell.jsx          # GlobalAudio + SceneLayer + Cursor + Toaster + <Routes>
│     │  ├─ routes.jsx            # public route'lar + lazy admin
│     │  └─ providers/            # ThemeProvider, EffectsProvider, ConsentProvider
│     ├─ styles/
│     │  ├─ globals.css           # @import "tailwindcss"; @theme token'ları
│     │  └─ fonts.css             # @fontsource-variable/* self-host
│     ├─ components/
│     │  ├─ ui/                   # shadcn (JSX) — elle düzenlenebilir
│     │  ├─ common/               # Skeleton varyantları, EmptyState, ErrorState, ExternalLink, SafeMarkdown
│     │  └─ media/                # SmartMedia (img/gif/video kararı), Lightbox
│     ├─ features/
│     │  ├─ scene/                # SceneLayer (arka plan, örtü yok), CursorManager
│     │  ├─ player/               # store.js (Zustand), GlobalAudio.jsx, PlayerBar.jsx
│     │  ├─ welcome/              # WelcomeOverlay.jsx
│     │  ├─ hero/                 # Hero.jsx, effects/ (Neon, Gradient, Particles, Stars)
│     │  ├─ status/               # DiscordCard, SpotifyCard, GithubCard
│     │  ├─ techstack/            # TechStackPlaceholder.jsx
│     │  ├─ projects/  about/  links/  contact/
│     │  ├─ downloads/            # DownloadGrid, DisclaimerDialog (wallpapers + pfps ortak)
│     │  ├─ consent/              # CookieBanner, PreferencesDialog
│     │  └─ layout/               # PublicLayout, Navbar, Footer, MobileNav
│     ├─ pages/                   # route seviyesinde ince bileşenler
│     │  ├─ HomePage.jsx  WallpapersPage.jsx  PfpsPage.jsx  ProjectDetailPage.jsx
│     │  ├─ LegalPage.jsx  NotFoundPage.jsx
│     ├─ admin/                   # TAMAMI lazy chunk
│     │  ├─ AdminApp.jsx  AdminLayout.jsx  Sidebar.jsx  Topbar.jsx
│     │  ├─ auth/                 # LoginPage, TwoFactorPage, ForgotPage, ResetPage, ChangePasswordPage
│     │  ├─ pages/                # her menü öğesi için klasör
│     │  └─ components/           # DataTable, UploadField(progress), SortableList, FormSection
│     ├─ lib/
│     │  ├─ api/                  # client.js (axios), publicApi.js, adminApi.js, queryKeys.js
│     │  ├─ auth/                 # authStore.js (access token bellekte), refresh kuyruğu
│     │  ├─ prefs.js              # localStorage güvenli okuma/yazma
│     │  └─ format.js             # süre, tarih (tr-TR), byte
│     └─ hooks/                   # useReducedEffects, useInView, useMediaQuery
└─ e2e/                           # Playwright testleri
```

### 2.1 Katman kuralları

- **Backend modül içi akış:** `routes.js` (path + middleware zinciri) → `controller.js` (HTTP ↔ servis çevirisi; req/res yalnızca burada) → `service.js` (iş kuralı, transaction) → Prisma. Servisler HTTP bilmez; test edilebilir saf fonksiyonlardır.
- Modüller arası çağrı yalnızca servis üzerinden (`import { reselectToday } from '../rotation/service.js'`); başka modülün controller/route'u import edilmez.
- **Frontend:** `pages/` ince; iş mantığı `features/`. Sunucu durumu TanStack Query'de, istemci durumu Zustand'da; ikisi karıştırılmaz.
- `packages/shared` hiçbir Node veya DOM API'sine bağımlı olamaz (iki tarafta da çalışmalı).

---

## 3. İstek yaşam döngüsü (backend middleware zinciri)

```text
gelen istek
 → requestId            (X-Request-Id)
 → pino-http            (redaction)
 → securityHeaders      (helmet + CSP)
 → cors                 (yalnızca dev/izinli origin)
 → compression          (proxy yoksa)
 → globalRateLimit      (public 300/dk/IP)
 → express.json({limit:'100kb'}) / cookieParser
 → originCheck          (state-changing metodlarda Origin/Referer == PUBLIC_ORIGIN)
 ┌ /api/public/*  → [endpoint rate limit] → validate(zod) → controller
 ├ /media/*       → mediaServe (yalnızca public-görünür asset)
 └ /api/admin/*   → noStore
                  → /auth/* (login, refresh, logout, forgot, reset, 2fa) özel zincir
                  → requireAuth (Bearer JWT doğrula, oturum canlı mı)
                  → passwordGate (mustChangePassword)
                  → requirePermission('<modül>:<eylem>')
                  → validate(zod)  → controller → service → audit.write()
 → notFound
 → errorHandler        (AppError → standart yanıt; bilinmeyen → 500, stack loglanır, istemciye verilmez)
```

---

## 4. Kimlik doğrulama akışı

### 4.1 Token modeli

| Token | Biçim | Ömür | Saklama (istemci) | Saklama (sunucu) |
|---|---|---|---|---|
| Access | JWT HS256 (`JWT_ACCESS_SECRET`) | 15 dk | Yalnızca bellek (Zustand) | — (stateless; `sid` ile oturum canlılığı kontrol edilir) |
| Refresh | 32 byte rastgele (base64url) | 7 gün (remember) / 12 saat (oturum) | `__Host-rt` HttpOnly Secure SameSite=Strict cookie | `AdminSession.refreshTokenHash` (SHA-256) |
| CSRF | `base64url(HMAC-SHA256(CSRF_SECRET, sessionId))` — oturuma bağlı, saklanmaz | refresh ile aynı (her rotasyonda yenilenir) | `__Host-csrf` cookie (HttpOnly **değil**, JS okur) + `X-CSRF-Token` header | Saklanmaz; istek anında refresh cookie'sinden bulunan `sessionId` ile yeniden hesaplanıp header ve cookie ile karşılaştırılır |
| MFA ara token | JWT (`aud: 'mfa'`) | 5 dk | Bellek | — |

`requireAuth`, JWT doğrulandıktan sonra `sid`'i bellek cache'li (30 sn TTL) bir sorgu ile kontrol eder: oturum iptal edildiyse 401. Böylece "oturumu sonlandır" en geç 30 sn içinde etkili olur.

**Uygulama notları (F3):**
- JWT `sid` = oturum **ailesinin** kimliği (`familyId`), satır kimliği değil. Canlılık = ailenin iptal edilmemiş, döndürülmemiş ve süresi dolmamış baş satırı var mı. Refresh rotasyonu aileyi değiştirmediği için mevcut access token'lar 15 dk ömürleri boyunca geçerli kalır; aile iptali hepsini aynı anda geçersiz kılar.
- Önbellek aynı süreçte iptal anında temizlenir (`invalidateFamilyCache`); yönetici alanı değiştiğinde (şifre, e-posta, 2FA, profil) o yöneticinin tüm önbellek girdileri düşürülür (`invalidateAdminCache`) ki `mustChangePassword` gibi bayraklar bayat kalmasın. Çoklu instance'ta diğer süreçler için üst sınır 30 sn TTL'dir.
- CSRF token'ı satır kimliğine bağlıdır (her rotasyonda değişir). Reuse tespiti CSRF kontrolünden **önce** yapılır: döndürülmüş token gelirse aile koşulsuz iptal edilir.
- Hesap Ayarları > Oturumlar listesindeki `id` de `familyId`'dir.
- Rate limiter'lar `createApp` başına oluşturulur (bellek içi); e-posta bazlı giriş sayacı başarılı girişte sıfırlanır.

### 4.2 Login + 2FA

```mermaid
sequenceDiagram
    autonumber
    participant B as Tarayıcı
    participant A as API
    participant D as DB
    B->>A: POST /api/admin/auth/login {email, password, rememberMe}
    A->>A: rate limit (IP + email)
    A->>D: AdminUser bul (yoksa dummy argon2 verify)
    A->>A: argon2.verify, kilit kontrolü
    alt Şifre hatalı
        A->>D: failedLoginCount++, gerekirse lockedUntil
        A-->>B: 401 INVALID_CREDENTIALS (genel mesaj)
    else 2FA açık
        A-->>B: 200 {mfaRequired:true, mfaToken}
        B->>A: POST /auth/2fa/verify {mfaToken, code}
        A->>A: TOTP doğrula (+lastTotpStep replay)
    end
    A->>D: AdminSession oluştur (familyId yeni, hash(refresh))
    A->>D: failedLoginCount=0, lastLoginAt, audit AUTH_LOGIN_SUCCESS
    A-->>B: 200 {accessToken, admin} + Set-Cookie __Host-rt, __Host-csrf
```

### 4.3 Refresh rotasyonu ve reuse tespiti

```mermaid
sequenceDiagram
    autonumber
    participant B as Tarayıcı
    participant A as API
    participant D as DB
    B->>A: POST /auth/refresh (cookie rt) + X-CSRF-Token
    A->>A: Origin + CSRF doğrula
    A->>D: session = find(refreshTokenHash)
    alt Bulunamadı / süresi dolmuş / revoked
        A-->>B: 401 + cookie sil
    else session.rotatedAt != null (REUSE)
        A->>D: familyId'deki tüm oturumları revoke(REUSE)
        A->>D: audit SESSION_REUSE_DETECTED
        A-->>B: 401 + cookie sil
    else Geçerli
        A->>D: updateMany(id, rotatedAt:null) → rotatedAt=now (count==1 şartı)
        A->>D: yeni session (aynı familyId, aynı rememberMe, expiresAt korunur*)
        A-->>B: 200 {accessToken} + yeni rt, csrf cookie
    end
```

\* Mutlak ömür korunur: yeni oturumun `expiresAt` değeri ailenin ilk oturumunun bitişini aşamaz (7 gün "kayan" değil, sabit pencere).

### 4.4 İstemci tarafı token yönetimi

- Uygulama açılışında admin route'una girilirse `POST /auth/refresh` sessizce denenir (cookie varsa oturum geri gelir).
- axios interceptor: `401 TOKEN_EXPIRED` → tek bir refresh isteği (eşzamanlı istekler kuyrukta bekler) → orijinal isteği yeniden dene. Refresh başarısızsa auth store temizlenir, `/admin/login?next=...`.
- Birden fazla sekme: `BroadcastChannel('auth')` ile logout ve yeni access token paylaşılır; aynı anda iki sekmenin refresh yapıp reuse tetiklemesi `navigator.locks.request('auth-refresh')` ile engellenir.
- Access token hiçbir zaman `localStorage`/`sessionStorage`'a yazılmaz.

### 4.5 Şifre sıfırlama

```text
POST /auth/forgot-password {email}
  → her durumda 202 (sabit gecikme ~400 ms + jitter)
  → hesap var + SMTP hazır: token üret, eski aktif token'ları usedAt=now, hash kaydet,
    PASSWORD_RESET şablonuyla e-posta: {PUBLIC_ORIGIN}/admin/reset-password#token=<token>
    (token URL fragment'ında → sunucu loglarına ve Referer'a düşmez)
POST /auth/reset-password {token, newPassword}
  → hash ile bul, süre/kullanım kontrolü → şifre güncelle → tüm oturumları revoke(PASSWORD_CHANGE)
  → usedAt=now → audit PASSWORD_RESET_COMPLETED → 200 (otomatik login YOK)
```

---

## 5. Public site çalışma zamanı

### 5.1 Uygulama kabuğu

```jsx
<QueryClientProvider>
  <ThemeProvider> <EffectsProvider> <ConsentProvider>
    <BrowserRouter>
      <AppShell>              // router'ın üstünde kalıcı katmanlar
        <SceneLayer />        // günlük arka plan, örtüsüz (public route'larda)
        <CursorManager />     // günlük cursor seti (public route'larda, pointer:fine)
        <GlobalAudio />       // TEK <audio> — hiç unmount olmaz
        <Routes>…</Routes>    // PublicLayout(Navbar, Outlet, PlayerBar, Footer) | AdminApp(lazy)
        <Toaster />  <CookieBanner />
      </AppShell>
    </BrowserRouter>
  </ConsentProvider> </EffectsProvider> </ThemeProvider>
</QueryClientProvider>
```

- `GlobalAudio` router dışında olduğu için route değişimi `<audio>`'yu yeniden oluşturmaz (FR-PLY-01). `PlayerBar` yalnızca kontrol arayüzüdür; store üzerinden `<audio>` ref'ine komut gönderir.
- Admin route'larına girildiğinde müzik **duraklatılmaz** (kullanıcı kontrolünde kalır) ama `SceneLayer` ve `CursorManager` admin'de devre dışıdır.

### 5.2 Veri yükleme sırası

1. `GET /api/public/site` (tek aggregate, kritik yol): ayarlar, hero, günlük seçimler (bg, müzik, pfp, cursor — URL'leriyle), nav bayrakları, footer, about, legal sürümü, entegrasyon açık/kapalı bayrakları.
2. Paralel, kritik olmayan: `/api/public/projects`, `/api/public/links`, `/api/public/status/*`.
3. Arka plan medyası: önce poster/thumbnail (LCP adayı değil — hero metni LCP'dir), sonra koşullar uygunsa video.

### 5.3 Tema/efekt boot sırası

```text
index.html <head>:
  inline script (CSP hash'li):
    prefs = safeParse(localStorage)
    html.dataset.theme   = prefs.theme ?? (matchMedia dark ? 'dark' : 'light')
    html.dataset.surface = prefs.surface ?? 'glass'
    html.dataset.effects = prefs.effects ?? (matchMedia reduced-motion ? 'low' : 'full')
  → CSS token'ları [data-theme], [data-surface], [data-effects] seçicileriyle çözülür
  → React mount olur, ThemeProvider aynı değerleri state'e alır
```

### 5.4 Cursor yönetimi

- `@media (pointer: fine)` ve `effects` ne olursa olsun uygulanır (cursor performans sorunu yaratmaz); `pointer: coarse` cihazlarda uygulanmaz.
- `html { cursor: url(normal) hx hy, auto }`; `pointerdown` → `html.dataset.pressed = 'true'` → `cursor: url(click) hx hy, auto`; `pointerup/pointercancel/blur` → kaldır.
- Tıklanabilir öğelerde (`a, button, [role=button]`) aynı set kullanılır (ayrı "pointer" imleci yok; set iki dosyadan oluşur).
- Dosya yüklenemezse CSS fallback `auto` devreye girer.

---

## 6. PWA yaşam döngüsü (OPSİYONEL — Faz 17)

Şartnamede PWA yoktur; doküman şablonunun beklentisi nedeniyle **opsiyonel** olarak tanımlanmıştır. Aktive edilirse kurallar:

### 6.1 Kapsam
- `vite-plugin-pwa` (`registerType: 'prompt'`, `injectManifest` yerine `generateSW`).
- Manifest: `name` = navbarTitle (build-time varsayılan), `display: standalone`, `theme_color` = tema token'ı, ikonlar 192/512 + maskable.
- Yalnızca **public uygulama kabuğu** (HTML, JS, CSS, fontlar) önbelleğe alınır.

### 6.2 Önbelleğe alınmayanlar (NetworkOnly)
- `/api/admin/*`, `/api/public/*` (canlı veri; offline'da son başarılı yanıt gösterilmez — tutarlılık için), `/media/*` (büyük dosyalar ve Range istekleri SW ile uyumsuz), `/api/public/downloads/*`.
- Admin route'ları SW navigation fallback'inden hariç (`navigateFallbackDenylist: [/^\/admin/, /^\/api/, /^\/media/]`).

### 6.3 Yaşam döngüsü
| Olay | Davranış |
|---|---|
| install | Precache manifest'teki kabuk dosyaları |
| waiting | Yeni sürüm varsa "Yeni sürüm hazır — Yenile" toast'ı |
| activate | Kullanıcı onayıyla `skipWaiting` + `clientsClaim`; eski cache'ler silinir |
| offline navigasyon | `offline.html` (marka uyumlu, "Bağlantı yok") |
| güncelleme kontrolü | Sayfa görünür olduğunda saatte bir `registration.update()` |

Müzik çalarken SW güncellemesi otomatik sayfa yenilemesi **yapmaz** (FR-PLY ile çakışmamak için yalnızca prompt).

---

## 7. Oturum yönetimi (admin)

| Konu | Karar |
|---|---|
| Eşzamanlı oturum | Sınırsız; Hesap Ayarları'nda listelenir |
| Mutlak ömür | remember: 7 gün; değilse 12 saat (sabit pencere) |
| Boşta kalma | 12 saatlik oturumda 2 saat refresh yoksa geçersiz (`lastUsedAt` kontrolü) |
| Şifre değişimi | Mevcut oturum hariç tüm oturumlar revoke |
| Şifre sıfırlama | Tüm oturumlar revoke |
| 2FA kapatma/açma | Mevcut hariç tüm oturumlar revoke |
| Rol/yetki değişimi | Hedef kullanıcının tüm oturumları revoke (yeni yetkiler yeni JWT'de) |
| Hesap pasife alma | Tüm oturumlar revoke; login reddedilir |
| Reuse tespiti | Aile revoke + audit + (SMTP varsa) güvenlik e-postası |
| Temizlik | Süresi dolmuş/iptal oturumlar 30 gün sonra silinir |

---

## 8. Medya hattı

```mermaid
flowchart TD
    U[Admin upload<br/>axios onUploadProgress] --> M[multer diskStorage → uploads/tmp<br/>limits.fileSize türe göre]
    M --> V{Doğrulama<br/>uzantı · file-type magic · MIME eşleşme}
    V -- hata --> X[tmp sil · 415/422]
    V -- ok --> T{Tür}
    T -- statik görsel --> S[Sharp: rotate · strip metadata · WebP ana + thumb]
    T -- GIF --> G[Koru · thumb ilk kare]
    T -- cursor/favicon --> C[Boyut kontrolü · olduğu gibi]
    T -- MP3 --> A[music-metadata süre · ffmpeg -map_metadata -1]
    T -- video --> Q[MediaAsset PENDING · mediaQueue]
    Q --> F[FFmpeg H.264 + faststart · poster · thumb]
    S & G & C & A & F --> W[storage.put → kalıcı anahtar<br/>uuid.ext]
    W --> R[MediaAsset READY · tmp sil]
    R --> O[Sahip kayıt bağlanır<br/>Background/Music/...]
```

- **Upload API iki adımlı değildir:** her içerik oluşturma endpoint'i (ör. `POST /api/admin/media/backgrounds`) `multipart` olarak hem dosyayı hem alanları alır. Video için yanıt `202` + kayıt `processingStatus: PENDING`; admin listesi PENDING/PROCESSING kayıtları 3 sn aralıkla yeniden çeker.
- PENDING/FAILED medyalı içerik public'te görünmez (`processingStatus = READY` şartı).
- `mediaQueue`: DB tabanlı (PENDING kayıtları `FOR UPDATE SKIP LOCKED` ile alır), eşzamanlılık 1, açılışta PROCESSING kalmış işleri PENDING'e çevirir.
- **Sunum (`/media/:assetId/:variant`):** `variant ∈ {main, thumb, poster}`. Asset'in public-görünür bir sahibi yoksa 404 (admin önizlemesi `/api/admin/media/:id/file/:variant` üzerinden yetkili). Range, ETag, `immutable` cache.
- **İndirme (`/api/public/downloads/:target/:publicId`):** yalnızca aktif + indirilebilir + READY; `downloadKey ?? storageKey` sunulur; sayaç §SRS FR-DSH-04.

- **Uygulama (F6):** `modules/media/` — `validate.js` (FR-MED-02 zinciri), `process.js` (Sharp/GIF/ikon/MP3), `formats.js` (yeniden kodlamasız metadata temizliği), `ffmpeg.js` (`spawn`, `shell: false`, 10 dk timeout), `service.js` (`ingestUpload`, SHA-256 tekrar uyarısı, koşullu silme), `library.js` (kullanım/görünürlük), `serve.js`, `upload.js` (multer). İşler `jobs/mediaQueue.js`, `jobs/storageGc.js`, `jobs/tmpCleanup.js`, `jobs/scheduler.js` (`server.js` başlatır; testlerde çalışmaz).
- **Video kaynağı:** yüklemede `tmp/queue/<assetId>.mp4` anahtarına taşınır, anahtar `MediaAsset.metadata.sourceKey`'de tutulur; iş bitince (READY/FAILED) silinir.
- **Silme yarışı:** asset silme `deleteMany({ id, ...ORPHAN_WHERE })` ile yapılır — arada sahip bağlanırsa silinmez (409). Çoklu ilişki `include`'u interaktif transaction içinde kullanılmaz (adapter-pg paralel sorgu uyarısı).
- **Sunum ayrıntısı:** `/media` router'ı `compression`'dan önce bağlanır (Range yanıtı sıkıştırılmaz); rate limit uygulanmaz. Public `Cache-Control: public, max-age=31536000, immutable`, admin önizleme `private, no-store`. Tek aralıklı Range (206), aralık dışı 416, `If-None-Match` → 304.

### 8.1 Storage soyutlaması

```js
// storage/index.js arayüzü (local ve s3 aynı imza)
put(tmpPath, key, { contentType })   // atomik: önce .partial, sonra rename
createReadStream(key, { start, end })
stat(key)                            // { size, mtime }
remove(key)
resolveUrl?                          // S3'te imzalı URL (opsiyonel)
```

 biçiminde olmalı ve `path.resolve(root, key)` sonucu `root` ile başlamalı, aksi hâlde `400 INVALID_STORAGE_KEY` (SEC-11). `s3.js` v1'de iskelettir (çağrılırsa hata). Dizin eşlemesi: `BACKGROUND→bg`, `MUSIC_AUDIO/MUSIC_COVER→musics`, `PROFILE→pfps`, `CURSOR→cursors`, `WALLPAPER→wallpapers`, `PROJECT_IMAGE→projects`, `LINK_IMAGE→links`, `FAVICON→favicons`; türevler `thumbnails/`, `posters/`.

---

## 9. Zamanlanmış işler

| İş | Zamanlama (Europe/Istanbul) | Açıklama |
|---|---|---|
| `rotation.daily` | `0 0 * * *` | 4 kategori için `selectForDate(today)`; süresi dolan override'ları sil |
| `dailySalt.rotate` | `0 0 * * *` (rotasyondan önce) | Yeni HMAC tuzu, eskisi silinir |
| `rotation.ensure` | Açılışta + her saat `5 * * * *` | Bugünün kaydı yoksa oluştur (kaçırılan cron) |
| `integrations.spotify.nowPlaying` | 60 sn interval | |
| `integrations.spotify.top` | 6 saatte bir | |
| `integrations.github` | Saatte bir | Profil + istatistik kart cache |
| `integrations.discord.full` | 5 dk | Gateway olaylarına ek tam yenileme |
| `storage.gc` | Dakikada bir | `StorageDeletionJob` işle |
| `uploads.tmpCleanup` | Saatte bir | 24 saatten eski tmp |
| `retention.cleanup` | `30 3 * * *` | SRS §11 tablosu |
| `backup` | `30 3 * * *` (sistem cron'u, uygulama dışı) | DATABASE.md §9 |

Tüm işler `jobs/scheduler.js`'te kayıtlıdır; her iş `try/catch` ile sarılır, hata loglanır, süreç çökmez. Aynı işin üst üste binmesi `running` bayrağıyla engellenir.

### 9.1 Ölçekleme yolu (v1 dışı)
Birden fazla instance gerekirse: (1) rate limit ve cache → Redis, (2) worker'lar ayrı süreç (`node src/worker.js`), (3) cron yalnızca worker'da, (4) Discord gateway tek worker'da. Rotasyon zaten advisory lock ile çoklu çalışmaya dayanıklıdır.

---

## 10. Ortam değişkenleri (`backend/.env.example`)

```dotenv
NODE_ENV=development
PORT=4000
PUBLIC_ORIGIN=http://localhost:5173        # prod: https://alanadi.com
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=1                              # Caddy arkasında

DATABASE_URL=postgresql://vasquez:CHANGE_ME@localhost:5447/vasquez

JWT_ACCESS_SECRET=                         # ≥ 64 byte rastgele
CSRF_SECRET=                               # ≥ 32 byte rastgele
APP_ENCRYPTION_KEY=                        # 32 byte base64 (AES-256-GCM)

STORAGE_DRIVER=local                       # local | s3
STORAGE_ROOT=./uploads
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

FFMPEG_PATH=                               # boşsa npm ile gelen ffmpeg-static (ek kurulum yok)
FFPROBE_PATH=                              # boşsa FFMPEG_PATH'in yanındaki / PATH'teki ffprobe

TURNSTILE_SITE_KEY=                        # frontend'e /api/public/site ile verilir (public)
TURNSTILE_SECRET_KEY=                      # prod'da zorunlu; dev/test'te boşsa Cloudflare'in
                                           # her zaman geçen resmi test anahtarları kullanılır

GITHUB_TOKEN=                              # opsiyonel, rate limit
GITHUB_STATS_BASE_URL=https://github-readme-stats.vercel.app
GITHUB_STREAK_BASE_URL=https://streak-stats.demolab.com

INITIAL_ADMIN_EMAIL=                       # yalnızca CLI çalıştırılırken
INITIAL_ADMIN_PASSWORD=                    # yalnızca CLI çalıştırılırken; sonra kaldır

LOG_LEVEL=info
```

`config/env.js` bu değişkenleri Zod ile doğrular; eksik/zayıf secret varsa (ör. 32 byte'tan kısa) süreç başlamaz. Discord bot token, Spotify client secret ve SMTP anahtarı **env'de değil**, admin panelinden girilir ve DB'de şifreli tutulur (Şartname §5, §16.3). Frontend `.env` dosyasında yalnızca `VITE_` önekli, gizli olmayan değerler bulunur (şu an gerekmiyor; Turnstile site key API'den gelir).

---

## 11. Dağıtım topolojisi (prod)

```text
VPS (Ubuntu LTS)
 ├─ Caddy :443  (otomatik TLS, HSTS, brotli)
 │    ├─ /            → /srv/vasquez/frontend/dist (SPA fallback → index.html)
 │    ├─ /api/*       → 127.0.0.1:4000
 │    └─ /media/*     → 127.0.0.1:4000
 ├─ Node 24 (systemd servis, kullanıcı: vasquez, NoNewPrivileges)
 ├─ PostgreSQL 17 (yalnızca localhost)
 ├─ ffmpeg (apt)
 └─ /var/lib/vasquez/storage  (kalıcı disk, yedekli)
```

- Statik `dist/` dosyaları: `index.html` için `Cache-Control: no-cache`; hash'li asset'ler için `immutable`.
- Proxy, `X-Forwarded-For`'u tek hop olarak ayarlar; Express `trust proxy = 1` (rate limit doğru IP görür).
