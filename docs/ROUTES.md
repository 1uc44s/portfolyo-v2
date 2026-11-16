# ROUTES — Frontend Route'ları ve API Endpoint'leri

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Bağlı: ARCHITECTURE.md §3–4, ADMIN.md §2
> Yanıt biçimi ve hata kodları: SRS.md §10. Tüm API yolları `/api` önekiyle başlar.

---

## 1. Yetkilendirme katmanları

| Katman | Ad | Kural |
|---|---|---|
| L0 | **Public** | Kimlik gerekmez. Yalnızca public-görünür kayıtlar ve public alanlar döner. |
| L1 | **Pre-auth** | Kimlik gerekmez ama özel rate limit + Origin kontrolü (login, forgot, reset, 2FA verify). |
| L2 | **Session-cookie** | Refresh cookie + CSRF double-submit + Origin (refresh, logout). |
| L3 | **Authenticated** | Geçerli access token (Bearer) + canlı oturum. `mustChangePassword` ise yalnızca izinli uçlar. |
| L4 | **Permission** | L3 + `requirePermission('<modül>:<read|write>')`. SUPER_ADMIN her izni geçer. |
| L5 | **Super-only** | L3 + `role === SUPER_ADMIN` (yönetici yönetimi, sistem ayarları, audit export, entegrasyon secret'ları). |

### 1.1 Middleware referansı

| Middleware | Görev |
|---|---|
| `originCheck` | POST/PUT/PATCH/DELETE için `Origin` (yoksa `Referer`) `PUBLIC_ORIGIN` ile eşleşmeli → değilse 403 `CSRF_FAILED` |
| `csrf` | `X-CSRF-Token` == `__Host-csrf` cookie == `HMAC(CSRF_SECRET, sessionId)` |
| `requireAuth` | `Authorization: Bearer` → JWT verify (`iss`, `aud=admin`, `exp`) → `sid` canlı mı (30 sn cache) → `req.admin` |
| `passwordGate` | `req.admin.mustChangePassword` ise allowlist dışı istekler → 403 `PASSWORD_CHANGE_REQUIRED` |
| `requirePermission(p)` | `role === SUPER_ADMIN` veya `permissions.includes(p)`; `write` izni `read`'i kapsar |
| `requireSuper` | `role === SUPER_ADMIN` |
| `validate({ body, query, params })` | Zod `.strict()` şemaları; sonuç `req.valid` içine |
| `rateLimit(name)` | SRS SEC-08 tablosu |
| `upload(kind)` | multer + tür limiti (SRS FR-MED-03) |
| `noStore` | `Cache-Control: no-store` (tüm `/api/admin`) |
| `audit(action)` | Controller sonrası başarılı yanıtta audit kaydı (servis de doğrudan yazabilir) |

---

## 2. Frontend route'ları

### 2.1 Public (`PublicLayout`: Navbar + Outlet + PlayerBar + Footer)

| Path | Sayfa | Veri | Görünürlük kuralı |
|---|---|---|---|
| `/` | HomePage | `site`, `projects`, `links`, `status/*` | Her zaman |
| `/wallpapers` | WallpapersPage | `wallpapers` | `nav.wallpapers=false` ise **boş durum ekranı** (navbar'da link yok) |
| `/pfps` | PfpsPage | `pfps` | `nav.pfps=false` ise boş durum ekranı |
| `/projects/:slug` | ProjectDetailPage | `projects/:slug` | 404 → NotFound |
| `/kvkk` | LegalPage(KVKK_NOTICE) | `legal/kvkk-notice` | Her zaman |
| `/cerez-politikasi` | LegalPage(COOKIE_POLICY) | `legal/cookie-policy` | Her zaman |
| `*` | NotFoundPage | — | 404 — PublicLayout **dışında**: menüsüz, TON 618 video arka planlı tam ekran (SRS FR-404-01..04) |

Ana sayfa bölüm çapaları: `#hakkimda`, `#linkler`, `#iletisim`, `#projeler` (navbar'da değil, footer ve deep-link için).

### 2.2 Admin (lazy chunk, `AdminApp`)

| Path | Sayfa | Koruma | İzin |
|---|---|---|---|
| `/admin/login` | LoginPage (`Hoşgeldiniz...`) | Giriş yapmışsa `/admin`'e yönlendir | — |
| `/admin/login/2fa` | TwoFactorPage | `mfaToken` bellekte yoksa login'e | — |
| `/admin/forgot-password` | ForgotPasswordPage | — | — |
| `/admin/reset-password` | ResetPasswordPage (token `#token=` fragment'tan) | — | — |
| `/admin/change-password` | ChangePasswordPage (zorunlu değişim) | L3 | — |
| `/admin` | DashboardPage | L4 | `dashboard:read` |
| `/admin/settings` | SiteSettingsPage (navbar, favicon, aktif medya, hakkımda, footer) | L4 | `settings:read` |
| `/admin/hero` | HeroPage (+ efekt önizleme) | L4 | `hero:read` |
| `/admin/media` | MediaHub (sekme: backgrounds) | L4 | `media:read` |
| `/admin/media/backgrounds` · `/musics` · `/pfps` · `/cursors` · `/project-images` · `/link-images` | Medya sekmeleri | L4 | `media:read` |
| `/admin/status` | IntegrationsPage (Discord, Spotify, GitHub) | L4 | `status:read` |
| `/admin/projects` | ProjectsPage (üstte "Kategori Oluştur" + "Proje Oluştur") | L4 | `projects:read` |
| `/admin/projects/new` · `/admin/projects/:id` | ProjectEditor | L4 | `projects:write` |
| `/admin/categories` | CategoriesPage | L4 | `categories:read` |
| `/admin/links` | LinksPage (+ public önizleme paneli) | L4 | `links:read` |
| `/admin/messages` · `/admin/messages/:id` | Messages | L4 | `messages:read` |
| `/admin/account` | AccountPage (e-posta, şifre, mail anahtarı, 2FA, oturumlar) | L3 | — (kendi hesabı) |
| `/admin/system` | SystemPage (rotasyon, şablonlar, yasal metinler, depolama, yöneticiler, işler) | L5 / kısmi L4 | bkz. ADMIN.md §3.13 |
| `/admin/audit` | AuditLogPage | L4 | `audit:read` |
| `/admin/*` | AdminNotFound | L3 | — |

Frontend koruması (`<RequireAuth>`, `<RequirePermission>`) yalnızca UX içindir; asıl yetkilendirme API'dedir (SEC-09). İzni olmayan menü öğeleri sidebar'da gösterilmez.

---

## 3. Public API (L0)

Tüm public GET yanıtları: `Cache-Control: public, max-age=30, stale-while-revalidate=60` (status uçları `max-age=15`).

| Metod | Path | Açıklama | Yanıt (`data`) |
|---|---|---|---|
| GET | `/api/health` | Liveness | `{ ok: true }` |
| GET | `/api/ready` | DB ping | `{ ok: true }` / 503 |
| GET | `/api/public/site` | Sayfa iskeleti aggregate (NFR-PERF-04) | aşağıda |
| GET | `/api/public/projects` | Yayındaki projeler (`?category=<id>` opsiyonel) | `ProjectCard[]` |
| GET | `/api/public/status/:provider/stream` | Canlı durum (SSE, `text/event-stream`): bağlanınca ve snapshot her değiştiğinde `event: status` + `GetStatus` JSON; 25 sn kalp atışı; en fazla 300 eş zamanlı akış (aşılırsa 503). Caddy `flush_interval -1` | SSE |
| GET | `/api/public/projects/:slug` | Proje detayı | `ProjectDetail` / 404 |
| GET | `/api/public/categories` | Yayında projesi olan aktif kategoriler | `{id,name}[]` |
| GET | `/api/public/links` | Aktif linkler (sıralı) | `{id,title,url,image:{url,thumbUrl,width,height}}[]` |
| GET | `/api/public/wallpapers` | `?cursor=<id>&limit=24` keyset, `id ASC` | `MediaCard[]` + `meta.nextCursor` |
| GET | `/api/public/pfps` | aynı | `MediaCard[]` + `meta.nextCursor` |
| GET | `/api/public/downloads/:target/:publicId` | Dosya indirme (`target ∈ wallpaper, pfp`); rate limit `download` | Binary, `attachment` |
| GET | `/api/public/status/discord` | Snapshot | `{enabled, stale, data}` |
| GET | `/api/public/status/spotify` | Snapshot | `{enabled, stale, data}` |
| GET | `/api/public/status/github` | Snapshot | `{enabled, stale, data, cards:{stats,streak}}` (kart URL'leri) |
| GET | `/api/public/status/github/cards/:card.svg` | `card ∈ stats, streak` proxy (FR-INT-G) | `image/svg+xml` |
| GET | `/api/public/legal/:key` | `key ∈ kvkk-notice, cookie-policy` | `{title, bodyMarkdown, version, updatedAt}` |
| POST | `/api/public/contact` | İletişim formu (FR-CNT-01..06). Sıra: honeypot → şema (422) → rate limit `contact10m`/`contactDay` (429) → Turnstile (422 `turnstileToken`, servis ulaşılamazsa 503 `CAPTCHA_UNAVAILABLE`) | `200 { ok:true }` — honeypot ile aynı yanıt (bot ayırt edemez); id dönmez |
| POST | `/api/public/consent` | Çerez tercihi kaydı `{consentId?, version, analytics}` | `{ consentId }` |
| POST | `/api/public/analytics/events` | Yalnızca istemci analitik izni varsa çağrılır; `{type, path, projectSlug?}`; rate limit | `204` |
| GET | `/media/:assetId/:variant` | Public medya (`main, thumb, poster`); READY + aktif/yayında sahip ya da site favicon'u şartı; Range (206/416), ETag (304), `immutable`, `nosniff`; bozuk depo anahtarı 400 | Binary / 404 |

### 3.1 `GET /api/public/site` yanıtı

```json
{
  "data": {
    "navbarTitle": "1uc44s GitHub",
    "faviconUrl": "/media/7c1e…/main",
    "nav": { "wallpapers": true, "pfps": false },
    "hero": {
      "displayName": "Lucas Vasquez",
      "tagline": "…",
      "location": "İstanbul",
      "nameEffects": ["NEON", "STARS"],
      "profile": { "type": "VIDEO", "url": "/media/…/main", "posterUrl": "/media/…/poster" }
    },
    "today": {
      "date": "2026-11-14",
      "background": { "type": "VIDEO", "url": "…", "posterUrl": "…", "source": "AUTO" },
      "music": { "title": "…", "artist": "…", "audioUrl": "…", "coverUrl": "…", "durationMs": 201000, "source": "MANUAL" },
      "cursor": { "normal": { "url": "…", "hotspot": [4, 2] }, "click": { "url": "…", "hotspot": [4, 2] } }
    },
    "about": { "title": "Hakkımda", "bodyMarkdown": "…" },
    "footer": { "techs": [{ "label": "React", "icon": "SiReact" }], "ownerName": "Vasquez" },
    "techStack": { "published": false },
    "integrations": { "discord": true, "spotify": true, "github": false },
    "sections": { "projects": true, "links": true, "about": true },
    "legal": { "cookiePolicyVersion": 3 },
    "captcha": { "provider": "turnstile", "siteKey": "0x4AAAA…" }
  }
}
```

`today.*` alanları içerik yoksa `null` döner (SRS §3.6 fallback'leri frontend'de). Hiçbir alan secret, iç ID (`assetId` hariç — medya URL'si için gerekli ve tahmin edilemez UUID) veya admin bilgisi içermez.

### 3.2 Public kayıt şekilleri

```text
ProjectCard   { slug, title, excerpt, cover:{url,thumbUrl,width,height,alt}|null, categories:[{id,name}] }
ProjectDetail { slug, title, descriptionMarkdown, images:[{url,thumbUrl,width,height,alt}], categories, links:{demo,video,github} }
MediaCard     { publicId, title, type:IMAGE|ANIMATED_IMAGE|VIDEO, previewUrl, thumbUrl, posterUrl|null, width, height, downloadUrl }
```

---

## 4. Admin API

Ortak: tüm uçlar `noStore`. Liste uçları `?page=1&pageSize=20&q=&sort=field:asc|desc` + uca özel filtreler. Medya içeren oluşturma/güncelleme uçları `multipart/form-data` (`file` alanı + JSON alanlar `data` alanında string olarak veya düz alanlar).

### 4.1 Auth (`/api/admin/auth`)

| Metod | Path | Katman | Rate limit | Gövde / Not |
|---|---|---|---|---|
| POST | `/login` | L1 | `login` | `{email, password, rememberMe}` → `{accessToken, admin}` veya `{mfaRequired, mfaToken}` |
| POST | `/2fa/verify` | L1 | `mfa` | `{mfaToken, code}` veya `{mfaToken, recoveryCode}` |
| POST | `/refresh` | L2 | `refresh` (IP 60/dk) | Cookie → `{accessToken, admin}` + yeni cookie'ler |
| POST | `/logout` | L2 | — | Mevcut oturumu revoke, cookie temizle → `204` |
| POST | `/forgot-password` | L1 | `forgot` | `{email}` → her zaman `202` |
| POST | `/reset-password` | L1 | `reset` (IP 10/saat) | `{token, newPassword}` → `200` |
| GET | `/me` | L3 (passwordGate izinli) | — | `{id, email, displayName, role, permissions, mustChangePassword, totpEnabled}` |

### 4.2 Hesap (`/api/admin/account`) — L3, yalnızca kendi hesabı

| Metod | Path | Gövde | Not |
|---|---|---|---|
| PATCH | `/profile` | `{displayName}` | |
| POST | `/email` | `{newEmail, currentPassword}` | Audit `EMAIL_CHANGED` |
| POST | `/password` | `{currentPassword, newPassword}` | passwordGate izinli; diğer oturumlar revoke |
| GET | `/mail` | — | `{smtpHost, smtpPort, smtpSecure, smtpUser, fromName, fromEmail, appPassword:{isSet}, notifyOnContact, notifyEmail, lastTestAt, lastTestOk}` |
| PUT | `/mail` | yukarıdaki alanlar + `appPassword?` (boş = değiştirme, `null` = sil) | Yalnızca SUPER_ADMIN (L5) — sistem geneli SMTP |
| POST | `/mail/test` | `{to?}` | SMTP_TEST şablonu; `502 UPSTREAM_ERROR` ayrıntılı ama secret'sız |
| POST | `/2fa/setup` | `{currentPassword}` | `{otpauthUrl, qrDataUrl, secret}` — `secret` QR okutulamayan cihazlarda elle girmek için; DB'de yalnızca şifreli `totpPendingSecretEnc` |
| POST | `/2fa/enable` | `{code}` | `{recoveryCodes: string[10]}` (bir kez) |
| POST | `/2fa/disable` | `{currentPassword, code \| recoveryCode}` | |
| POST | `/2fa/recovery-codes` | `{currentPassword, code}` | Yeniden üret (eskiler geçersiz) |
| GET | `/sessions` | — | `{id, current, userAgent, ipAddress, createdAt, lastUsedAt, expiresAt, rememberMe}[]` |
| DELETE | `/sessions/:id` | — | Audit `SESSION_REVOKED` |
| POST | `/sessions/revoke-others` | — | |

### 4.3 Dashboard — `dashboard:read`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/dashboard/summary?range=7d\|30d\|90d` | `{visitors:{total,today,week,month,series:[{day,count}]}, topWallpapers[5], topPfps[5], topProjects[5], recentAudit[10], integrations[3], storage:[{kind,bytes,count}], warnings:[{code,message}]}`. Ziyaretçi = günlük benzersiz `visitorHash` (PAGE_VIEW); hafta/ay/toplam = günlük benzersizlerin toplamı (yaklaşık). Son işlemler `audit:read` yoksa boş dizi |

### 4.4 Site ayarları — `settings:*`

| Metod | Path | İzin | Gövde |
|---|---|---|---|
| GET | `/api/admin/settings` | read | Site + about + footer + `faviconUrl` + `favicon {url, mimeType, width, height}|null` |
| PATCH | `/api/admin/settings` | write | `{navbarTitle?, footerTechs?}` |
| PUT | `/api/admin/settings/favicon` | write | multipart `file` (FAVICON: ico/png, ≤ 512×512, ≤ 1 MB); rate limit `upload`. Yanıt `{ data: Settings, meta: { duplicateOf: {id,title}|null } }`. Eski favicon asset'i silinip dosyaları kuyruğa yazılır |
| DELETE | `/api/admin/settings/favicon` | write | Varsayılana dön (`faviconUrl: null`) |
| PUT | `/api/admin/settings/about` | write | `{title, bodyMarkdown}` |
| GET | `/api/admin/rotation` | read | 4 kategori: `{today:{item, source}, override:{item, validUntil}\|null, cycle:{number, used, total}}` |
| PUT | `/api/admin/rotation/:category/override` | write | `{contentId}` → validUntil hesaplanır |
| DELETE | `/api/admin/rotation/:category/override` | write | "Otomatiğe dön" |
| POST | `/api/admin/rotation/:category/reselect` | write | Bugünkü otomatik seçimi yenile |

### 4.5 Hero — `hero:*`

| Metod | Path | İzin / Gövde |
|---|---|---|
| GET | `/api/admin/hero` | read |
| GET | `/api/admin/hero/profile-options` | read · sabit profil seçenekleri: aktif + READY profil medyası `{id, title, mediaType, thumbUrl}` (önizleme public `/media` URL'i; `media:read` gerekmez) |
| PUT | `/api/admin/hero` | write · `{displayName, tagline, location, nameEffects[], gradientFrom, gradientTo, profileMode, fixedProfileMediaId?}` — FIXED için seçilen profil medyası aktif ve READY olmalı (422) |

### 4.6 Medya — `media:*`

Her içerik türü aynı CRUD kalıbını izler:

| Kaynak | Base path | Oluşturma alanları |
|---|---|---|
| Arka planlar | `/api/admin/media/backgrounds` | `file`, `title`, `isActive`, `rotationEnabled`, `isWallpaper` |
| Müzikler | `/api/admin/media/musics` | `audio` (mp3), `cover`, `title`, `artist?`, `isActive`, `rotationEnabled` |
| Profil fotoğrafları | `/api/admin/media/pfps` | `file`, `title`, `isActive`, `isDownloadable`, `rotationEnabled` |
| Cursor setleri | `/api/admin/media/cursors` | `normal`, `click` (ikisi **aynı istekte zorunlu**), `title`, hotspot'lar, `isActive`, `rotationEnabled` |

> F7 uygulama notları: Yuvalar, anahtarlar ve form şemaları `packages/shared/src/validation/media.js` (`MEDIA_CONTENT`, `mediaCreateSchema`…) içinde tek kaynaktır. Hotspot alanları `normalHotspotX/Y`, `clickHotspotX/Y` (0–127; sunucu ayrıca görsel genişlik/yüksekliğiyle sınırlar → 422). multipart'ta boolean'lar `"true"/"false"` metni olarak gelebilir. Dosya hata ayrıntılarının `path` değeri ilgili yuva adıdır (`audio`, `cover`, `normal`, `click`, `file`). Çok dosyalı isteklerde bir dosya reddedilirse aynı istekte yüklenmiş diğer asset'ler geri alınır. Yanıt `meta: { duplicateOf, duplicates: [{field,id,title}] }` (FR-MED-10).

| Metod | Path | Not |
|---|---|---|
| GET | `{base}` | Liste: `?q, isActive, isDownloadable, type, status, sort` |
| GET | `{base}/:id` | Detay (+ kullanım bilgisi: bugün seçili mi, override mı) |
| POST | `{base}` | multipart; görsel `201`, video `202` (PENDING) |
| PATCH | `{base}/:id` | Alan güncelleme (dosya değişmez) |
| PUT | `{base}/:id/file` | Dosya değiştir (yeni asset → eski asset kuyruğa); cursor için `normal`+`click` birlikte (+ opsiyonel hotspot alanları); müzikte `audio` ve/veya `cover` (ses değişirse `durationMs` yenilenir). Video → `202` |
| PATCH | `{base}/reorder` | `{ids:[...]}` — yalnızca sortOrder olan türler (backgrounds, musics, cursors); liste türün **tüm** kayıtlarını içermeli, değilse 422 |
| DELETE | `{base}/:id` | DATABASE.md §5.2 akışı |

Kütüphane uçları:

| Metod | Path | İzin | Not |
|---|---|---|---|
| GET | `/api/admin/media/assets` | read | `?kind, status, orphan=true, limit (≤100), cursor` — `createdAt DESC`, `meta.nextCursor`; her öğe `usage[]` ile (iç depo anahtarları dönmez) |
| GET | `/api/admin/media/assets/:id` | read | Metadata + kullanım listesi |
| GET | `/api/admin/media/assets/:id/file/:variant` | read | Yetkili önizleme (pasif/yetim dahil, yalnızca READY); `private, no-store` |
| DELETE | `/api/admin/media/assets/:id` | write | Yalnızca orphan; değilse `409 IN_USE` + kullanan kayıtlar |
| GET | `/api/admin/media/storage` | read | Tür bazında byte/adet |

### 4.7 Durumlar / entegrasyonlar — `status:*` (secret alanları L5)

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/integrations` | 3 sağlayıcı: `{provider, isEnabled, config, secrets:{botToken:{isSet}}, status, lastSyncAt, lastSuccessAt, lastError}` |
| PATCH | `/api/admin/integrations/:provider` | `{isEnabled?, config?}` (`status:write`) |
| PUT | `/api/admin/integrations/:provider/secrets` | L5 · `{botToken}` / `{clientId, clientSecret}`; değerler yanıtta dönmez |
| POST | `/api/admin/integrations/:provider/test` | `status:write` · senkron test |
| POST | `/api/admin/integrations/:provider/sync` | `status:write` · snapshot'ı şimdi yenile |
| GET | `/api/admin/integrations/spotify/authorize` | L5 · `{url}` döner; `state` imzalı cookie (`__Host-sp_state`, 10 dk) |
| GET | `/api/admin/integrations/spotify/callback` | Spotify yönlendirmesi; `state` doğrula → token al → `/admin/status?spotify=connected` |
| DELETE | `/api/admin/integrations/spotify/connection` | L5 · refresh token sil |

> `spotify/callback` tarayıcı yönlendirmesiyle gelir; Bearer token taşıyamaz. Koruma: imzalı `state` cookie'si (HMAC + adminId + exp) ve tek kullanımlık. Başarıda yalnızca state'teki admin adına kaydedilir.

### 4.7b Yağan öğeler — `hero:*` (2026-11-16)

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/falling-items` | read · `{items[], limits}` |
| POST | `/api/admin/falling-items` | write · multipart: `kind=IMAGE` + `image` dosyası **veya** `kind=TEXT` + `text`; `size`, `isActive` |
| PATCH | `/api/admin/falling-items/:id` | write · `{text?, size?, isActive?}` |
| PUT | `/api/admin/falling-items/:id/image` | write · görseli değiştir (yalnızca IMAGE) |
| PATCH | `/api/admin/falling-items/reorder` | write · `{ids[]}` |
| DELETE | `/api/admin/falling-items/:id` | write |

İsim GIF katmanları medya türü olarak: `/api/admin/media/name-overlays` (alanlar `file`, `title`, `isActive`, `rotationEnabled`), §4.6 ile aynı uçlar. Public `/api/public/site` yanıtına `hero.gradientFrom/gradientTo`, `today.nameOverlay {url}` ve `falling[]` (`{id, type:'IMAGE', url, size}` | `{id, type:'TEXT', text, size}`) eklenir.

### 4.8 Projeler — `projects:*`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/projects` | `?q, isPublished, categoryId, sort` |
| GET | `/api/admin/projects/:id` | |
| POST | `/api/admin/projects` | `{title, description, slug?, demoUrl?, videoUrl?, githubUrl?, categoryIds:[], isPublished, sortOrder?}` (en az bir link) |
| PATCH | `/api/admin/projects/:id` | Kısmi |
| POST | `/api/admin/projects/:id/images` | multipart `files[]` (≤ 10/istek), her biri PROJECT_IMAGE |
| PATCH | `/api/admin/projects/:id/images/reorder` | `{ids}` (ilk = kapak) |
| PATCH | `/api/admin/projects/:id/images/:imageId` | `{alt}` |
| DELETE | `/api/admin/projects/:id/images/:imageId` | Asset + dosya kuyruğu |
| PATCH | `/api/admin/projects/reorder` | `{ids}` |
| GET | `/api/admin/projects/slug-check?slug=` | `{available, suggestion}` |
| DELETE | `/api/admin/projects/:id` | |

### 4.9 Kategoriler — `categories:*`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/categories` | `projectCount` dahil |
| POST | `/api/admin/categories` | `{name, isActive?}` → 409 çakışma |
| PATCH | `/api/admin/categories/:id` | `{name?, isActive?}` |
| PATCH | `/api/admin/categories/reorder` | `{ids}` |
| DELETE | `/api/admin/categories/:id` | Kullanımdaysa `409 IN_USE {projectCount}` |
| POST | `/api/admin/categories/:id/reassign-and-delete` | `{targetCategoryId \| null}` — hedef null ise ilişkiler kaldırılır; projesi kategorisiz kalan yayındaki projeler listesi uyarı olarak döner |

### 4.10 Linkler — `links:*`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/links` | |
| POST | `/api/admin/links` | multipart `image` + `{title, url, isActive, sortOrder?}` |
| PATCH | `/api/admin/links/:id` | `{title?, url?, isActive?}` |
| PUT | `/api/admin/links/:id/image` | Görsel değiştir |
| PATCH | `/api/admin/links/reorder` | `{ids}` |
| DELETE | `/api/admin/links/:id` | |

### 4.11 İletişim mesajları — `messages:*`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/contact-messages` | `?view=inbox\|unread\|pending\|replied\|spam` (varsayılan `inbox` = spam hariç), `q` (ad/soyad/e-posta/konu, büyük-küçük harf duyarsız), `page` (1…), `limit` ≤ 100 (varsayılan 50). Sıra: okunmamış önce, `createdAt DESC`. Öğe: gövde yerine `preview` (≤ 140 karakter). `meta {total, page, limit}` |
| GET | `/api/admin/contact-messages/unread-count` | `{ count }` — okunmamış ve spam olmayan; sidebar rozeti |
| GET | `/api/admin/contact-messages/:id` | Tam mesaj; açınca okundu işaretler (`messages:read` yeterli) |
| PATCH | `/api/admin/contact-messages/:id` | `{isRead?, status?, isSpam?}` (en az biri). `REPLIED` → `repliedAt=now`; `PENDING` → `repliedAt=null` |
| POST | `/api/admin/contact-messages/:id/reply-links` | `{mailto}` — `CONTACT_REPLY_EMAIL` şablonuyla üretilmiş `mailto:` linki; audit `CONTACT_REPLY_LINK_OPENED` |
| DELETE | `/api/admin/contact-messages/:id` | Kalıcı silme (`messages:write`) |

### 4.13 Tech Stack — `settings:*` (F21)

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/tech-stack` | `{published, title:{top,main,bottom}, items:[{id,label,description,isActive,sortOrder,image}]}` |
| PUT | `/api/admin/tech-stack/settings` | `{published, titleTop (≤ 20), titleMain (1–40), titleBottom (≤ 40)}` |
| POST | `/api/admin/tech-stack/items` | multipart: `label` (1–40), `description` (≤ 2000, düz metin), `isActive`, opsiyonel `image`. En fazla 9 öğe (409) |
| PATCH | `/api/admin/tech-stack/items/:id` | `{label?, description?, isActive?}` |
| PUT / DELETE | `/api/admin/tech-stack/items/:id/image` | Görsel değiştir / kaldır |
| PATCH | `/api/admin/tech-stack/items/reorder` | `{ids}` (tam liste) |
| DELETE | `/api/admin/tech-stack/items/:id` | Öğe + görsel silme kuyruğuna |

Public: `GET /api/public/tech-stack` → yayında değilse `{published:false}`; yayındaysa `{published:true, title, items:[{id,label,description,image:{url,width,height}|null}]}` (yalnızca aktif öğeler, `sortOrder`).

### 4.12 Sistem — karışık (ADMIN.md §3.13)

| Metod | Path | Katman | Not |
|---|---|---|---|
| GET/PUT | `/api/admin/system/templates` · `/:key` | `system:write` | Şablon listele/düzenle (CMS.md §5) |
| POST | `/api/admin/system/templates/:key/preview` | `system:read` | Örnek değişkenlerle render |
| POST | `/api/admin/system/templates/:key/reset` | `system:write` | Varsayılana dön |
| GET/PUT | `/api/admin/system/legal/:key` | GET `system:read`, PUT `system:write` | `key ∈ kvkk-notice, cookie-policy`. PUT `{title (1–120), bodyMarkdown (≤ 50 000), bumpVersion}`; `bumpVersion=true` → `version+1` (çerez politikasında banner yeniden sorulur) |
| GET | `/api/admin/system/jobs` | L5 | Zamanlanmış işler: son çalışma, durum |
| POST | `/api/admin/system/jobs/:name/run` | L5 | Manuel tetik (rotation.ensure, storage.gc, retention.cleanup) |
| — | `/api/admin/tech-stack/*` | `settings:*` | F21: §4.13 (FR-PUB-04B)'e taşındı |
| GET | `/api/admin/admins` | L5 | Yöneticiler |
| POST | `/api/admin/admins` | L5 | `{email, displayName, role, permissions}` → geçici şifre bir kez gösterilir, `mustChangePassword=true` |
| PATCH | `/api/admin/admins/:id` | L5 | `{role?, permissions?, isActive?}` → hedefin oturumları revoke |
| POST | `/api/admin/admins/:id/reset-2fa` | L5 | Kayıp cihaz kurtarma |
| DELETE | `/api/admin/admins/:id` | L5 | Son SUPER_ADMIN ve kendisi silinemez |

### 4.13 Audit — `audit:read`

| Metod | Path | Not |
|---|---|---|
| GET | `/api/admin/audit-logs` | `?from, to, adminId, action, entityType, entityId` (sayfalı, `createdAt DESC`) |
| GET | `/api/admin/audit-logs/export.csv` | L5 · aynı filtreler, maks. 50 000 satır, stream |

---

## 5. HTTP durum kodu davranış özeti

| Senaryo | Kod |
|---|---|
| Boş koleksiyon (`/links`, `/wallpapers`…) | `200` + `[]` |
| Yayında olmayan proje slug'ı | `404` |
| Pasif / duvar kağıdı olmayan background indirme | `404` (varlık ifşa edilmez) |
| Kapalı entegrasyon status | `200 { enabled:false, data:null }` |
| Entegrasyon snapshot'ı yok/hata | `200 { enabled:true, stale:true, data:null, error:"UNAVAILABLE" }` (public sayfa çökmez) |
| Yetkisiz admin isteği | `401` (token yok/süresi dolmuş) · `403` (izin yok) |
| Upload türü geçersiz | `415` · boyut `413` · alan `422` · FFmpeg yok (video) `503 MEDIA_PROCESSOR_UNAVAILABLE` |
| Kullanımdaki kategori/medya | `409 IN_USE` |
| Login kilidi | `423 ACCOUNT_LOCKED` + `retryAfter` (kilit durumu ancak doğru şifre girilirse açıklanır; aksi hâlde genel 401) |

---

## 6. Rate limit anahtar tablosu

| Ad | Anahtar | Limit |
|---|---|---|
| `publicGlobal` | IP | 300 / dk |
| `login` | IP · e-posta | 10 / 15 dk · 5 / 15 dk |
| `mfa` | mfaToken jti | 5 / 15 dk |
| `refresh` | IP | 60 / dk |
| `forgot` | IP · e-posta | 3 / saat · 3 / saat |
| `reset` | IP | 10 / saat |
| `contact` | IP | 3 / 10 dk, 10 / gün |
| `download` | IP | 30 / 10 dk |
| `analytics` | IP | 120 / dk |
| `consent` | IP | 20 / saat |
| `adminApi` | adminId | 600 / dk |
| `upload` | adminId | 60 / 10 dk |

429 yanıtları `Retry-After` header'ı içerir; audit'e yalnızca `login`/`mfa`/`forgot` için `RATE_LIMITED` yazılır.
