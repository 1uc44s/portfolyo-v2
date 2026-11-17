# RULES — Kod, Güvenlik ve Tasarım Standartları

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Kapsam: tüm depo
> Bu kurallar PR incelemesinde kontrol edilir. "YASAK" ile işaretli kuralın istisnası yoktur; diğerlerinden sapma PR açıklamasında gerekçelendirilir.

---

## 1. Dil ve proje geneli

1. **Yalnızca JavaScript (ESM) ve JSX.** `.ts`, `.tsx`, `.d.ts`, `tsconfig.json` **YASAK**. CI, depoda bu uzantıları bulursa build'i kırar. Tip ihtiyacı JSDoc ile karşılanır (`/** @param {string} slug */`); `// @ts-check` kullanılmaz.
2. Tüm paketlerde `"type": "module"`. `require` yok. Node yerleşikleri `node:` önekiyle (`import fs from 'node:fs/promises'`).
3. Prisma generator `prisma-client-js`; TS çıktısı üreten generator **YASAK**.
4. Animasyon için yalnızca **Framer Motion** (`motion/react`). AnimeJS ve başka animasyon kütüphanesi **YASAK**. Basit hover/geçişler CSS ile.
5. İkonlar: Lucide React birincil; React Icons yalnızca Lucide'de olmayan marka logoları (`react-icons/si`) için. Aynı kavram için iki kütüphaneden ikon kullanılmaz; eşleme `frontend/src/components/common/icons.js`'te tek yerde.
6. **Docs-first:** Davranış değiştiren her PR ilgili `/docs` dosyasını aynı PR'da günceller. Doküman güncellemesi olmayan özellik PR'ı reddedilir.
7. Bağımlılık eklemek: önce mevcut bağımlılıkla çözülebilir mi kontrol edilir; yeni paket için PR'da gerekçe, bakım durumu ve boyut belirtilir. Sürümler `package-lock.json` ile kilitlenir.

---

## 2. Biçim ve adlandırma

| Öğe | Kural | Örnek |
|---|---|---|
| React bileşen dosyası | PascalCase `.jsx` | `LinksSection.jsx` |
| Diğer JS dosyaları | camelCase `.js` | `rateLimit.js`, `normalizeKey.js` |
| Klasörler | kebab-case | `profile-media/` |
| Bileşen | PascalCase, **named export** | `export function LinkCard()` |
| Hook | `use` öneki | `useReducedEffects` |
| Sabit | UPPER_SNAKE | `MAX_LINKS_PER_ROW` |
| Boolean | `is/has/can/should` öneki | `isDownloadable` |
| Olay işleyici | `handle*` (tanım), `on*` (prop) | `onSelect={handleSelect}` |
| API path | kebab-case, çoğul kaynak | `/contact-messages/:id` |
| DB tablo/sütun | snake_case (`@@map`/`@map`) | `download_count` |
| Audit action | UPPER_SNAKE `<ENTITY>_<VERB>` | `LINK_UPDATED` |

- Prettier: 2 boşluk, tek tırnak, noktalı virgül, `printWidth: 100`, trailing comma `all`.
- Default export yalnızca `React.lazy` ile yüklenen sayfa modüllerinde ve config dosyalarında.
- Dosya uzunluğu yumuşak sınır 300 satır; fonksiyon 50 satır. Aşılıyorsa bölünür.
- Yorumlar "neden"i anlatır, "ne"yi değil. Çözülmemiş iş için `// TODO(TODO.md#T-xxx):` biçimi.

---

## 3. Clean code ilkeleri

1. **Tek sorumluluk:** route → controller → service → Prisma (ARCHITECTURE.md §2.1). Controller iş kuralı içermez; service `req/res` görmez.
2. **Erken dönüş**, iç içe `if` yerine guard clause.
3. **Sihirli değer yok:** limitler, süreler, MIME listeleri `packages/shared/src/constants/` içinde.
4. **Saf fonksiyonlar tercih edilir;** yan etki (DB, dosya, ağ) servis sınırında toplanır. Rotasyon seçim mantığı (`pickCandidate(pool, used, yesterday, rng)`) saf fonksiyon olarak ayrılır ve deterministik RNG ile test edilir.
5. **Hata yönetimi:** beklenen hatalar `AppError` alt sınıflarıyla fırlatılır (`NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`...). `catch` bloğu hatayı yutmaz: ya anlamlı şekilde dönüştürür ya yeniden fırlatır ya da loglayıp kontrollü fallback uygular (yalnızca entegrasyon/worker katmanında).
6. Express 5 async handler hatalarını otomatik yakalar; ek `asyncHandler` sarmalayıcısı kullanılmaz.
7. **Tekrar etme, ama erken soyutlama da yapma:** üçüncü tekrarda ortaklaştır.
8. **Boolean parametre yerine seçenek nesnesi:** `listBackgrounds({ includeInactive: true })`.
9. Tarih/saat: yalnızca `lib/time.js` üzerinden (`todayInIstanbul()`, `nextIstanbulMidnight()`); `new Date().getDate()` ile gün hesabı **YASAK**.
10. Frontend: sunucu durumu yalnızca TanStack Query'de; `useEffect` içinde fetch **YASAK**. Query anahtarları `lib/api/queryKeys.js`'te.

---

## 4. SQL injection koruması (Prisma)

> Şablondaki "PDO" maddesinin karşılığıdır: PDO prepared statement'larının Node/Prisma eşdeğeri parametreli sorgulardır.

1. Tüm veri erişimi Prisma Client sorgu API'si ile (`findMany`, `create`, `update`...). Prisma bu sorguları her zaman parametreli gönderir.
2. Raw SQL gerekiyorsa **yalnızca tagged template** biçimi: `` prisma.$queryRaw`SELECT ... WHERE id = ${id}` `` ve `` $executeRaw`...` ``. Değerler otomatik parametrelenir.
3. `$queryRawUnsafe` ve `$executeRawUnsafe` **YASAK** (ESLint `no-restricted-properties` kuralı ile engellenir).
4. Dinamik sıralama/sütun adı kullanıcıdan gelemez; izinli liste (allowlist) haritasıyla eşlenir:
   ```js
   const SORTABLE = { createdAt: 'createdAt', title: 'title', sortOrder: 'sortOrder' };
   const orderBy = { [SORTABLE[field] ?? 'createdAt']: dir === 'asc' ? 'asc' : 'desc' };
   ```
5. `Prisma.sql` / `Prisma.join` ile sorgu birleştirme yalnızca değerler için; tanımlayıcılar (tablo/sütun) için `Prisma.raw` kullanıcı girdisiyle **YASAK**.
6. Arama (`q`) Prisma `contains` + `mode: 'insensitive'` ile; LIKE kalıbı elle kurulmaz.
7. Tüm girdiler Zod ile tür ve uzunluk açısından doğrulanır (ikinci savunma hattı). ID parametreleri `z.coerce.number().int().positive()` veya `z.string().uuid()`.

---

## 5. XSS, CSRF ve diğer güvenlik filtreleri

### 5.1 XSS
1. React'in otomatik escaping'ine güvenilir. `dangerouslySetInnerHTML` **YASAK** (ESLint `react/no-danger`: error). Tek istisna yoktur; Markdown `SafeMarkdown` bileşeniyle render edilir (CMS.md §4).
2. Kullanıcı kaynaklı URL'ler `href`/`src`'e yazılmadan önce `isSafeHttpUrl()` ile kontrol edilir (savunma derinliği; asıl kontrol kayıt anında).
3. SVG yükleme **YASAK** (script taşıyabilir). GitHub istatistik SVG'leri yalnızca `<img>` ile ve kısıtlı CSP header'ıyla sunulur.
4. CSP SRS §9.1'deki gibi; inline script yalnızca hash'li tema init script'i. Yeni inline script eklemek CSP hash güncellemesi gerektirir (build adımı otomatik hesaplar).
5. E-posta HTML'inde tüm değişkenler escape edilir (CMS.md §5.2).
6. Hata mesajlarında kullanıcı girdisi yansıtılmaz (ör. "`<script>` bulunamadı" yerine "Kayıt bulunamadı").

### 5.2 CSRF
1. Admin veri API'si Bearer token kullanır → tarayıcı otomatik eklemez → klasik CSRF'e kapalı.
2. Cookie kullanan uçlar (`/auth/refresh`, `/auth/logout`, Spotify callback): `SameSite=Strict` + double-submit `X-CSRF-Token` (oturuma HMAC ile bağlı) + `originCheck`. Spotify callback imzalı `state` ile korunur.
3. Tüm state-changing istekler (`POST/PUT/PATCH/DELETE`, public dahil) `originCheck`'ten geçer.
4. GET istekleri **hiçbir zaman** durum değiştirmez (istisna: mesaj detayı açıldığında `isRead` — idempotent ve yetkili; kabul edilmiş istisna).

### 5.3 Dosya yükleme
1. Uzantı allowlist + `file-type` magic bytes + uzantı/MIME eşleşmesi + yeniden kodlama (SRS FR-MED-02..08).
2. Disk yolu yalnızca sunucunun ürettiği `storageKey`'den; kullanıcı dosya adı yol olarak **YASAK**.
3. `path.resolve` sonucu depo kökü dışındaysa işlem reddedilir.
4. FFmpeg/Sharp çağrılarında argümanlar dizi olarak verilir; shell string'i (`exec`) **YASAK** (`spawn` + `shell: false`).

### 5.4 Secret ve kişisel veri
1. Secret'lar kodda, `.env.example` dışındaki commit'lenmiş dosyalarda, frontend bundle'ında, loglarda ve API yanıtlarında **YASAK**.
2. Şifreli DB alanları yalnızca kullanım anında çözülür; çözülmüş değer değişkende tutulur, nesneye eklenip döndürülmez.
3. Log redaction yolları SRS NFR-OBS'de; yeni secret alanı eklendiğinde redaction listesi aynı PR'da güncellenir.
4. Ham IP: yalnızca `AdminSession.ipAddress` ve `AuditLog.ipAddress` (yönetici güvenliği). Ziyaretçi IP'si yalnızca HMAC'li tutulur.
5. Gerçek kişisel veri test fixture'larında **YASAK**; `faker` ile üretilir.

### 5.5 Diğer
- `helmet()` varsayılanları + CSP + `crossOriginResourcePolicy: same-site`; `x-powered-by` kapalı.
- JSON body limiti 100 KB; multipart yalnızca upload uçlarında.
- Zaman sabit karşılaştırma: token/HMAC karşılaştırmaları `crypto.timingSafeEqual`.
- Rastgelelik: `crypto.randomBytes` / `crypto.randomInt`; `Math.random` güvenlik veya seçim mantığında **YASAK** (rotasyon dahil).
- Dış servis çağrılarında zaman aşımı zorunlu (`AbortSignal.timeout(5000)`).
- Yönlendirmelerde (`next` parametresi) yalnızca `/admin` ile başlayan göreli yollar kabul edilir (open redirect önlemi).

---

## 6. Audit action listesi (tam)

```
AUTH_LOGIN_SUCCESS  AUTH_LOGIN_FAILED  AUTH_LOGOUT  AUTH_2FA_FAILED  AUTH_LOCKED  AUTH_LOCK_BYPASSED  AUTH_REAUTH_FAILED  RATE_LIMITED
SESSION_REVOKED  SESSION_REUSE_DETECTED
PASSWORD_CHANGED  PASSWORD_RESET_REQUESTED  PASSWORD_RESET_COMPLETED  PASSWORD_RESET_SMTP_MISSING
EMAIL_CHANGED  2FA_ENABLED  2FA_DISABLED  2FA_RECOVERY_REGENERATED  2FA_RESET_BY_ADMIN
ADMIN_CREATED  ADMIN_UPDATED  ADMIN_PERMISSIONS_CHANGED  ADMIN_DEACTIVATED  ADMIN_DELETED
SETTINGS_UPDATED  FAVICON_UPDATED  ABOUT_UPDATED  HERO_UPDATED  MAIL_SETTINGS_UPDATED  SMTP_TESTED
MEDIA_UPLOADED  MEDIA_DELETED  MEDIA_PROCESSING_FAILED
BACKGROUND_CREATED|UPDATED|DELETED  MUSIC_*  PROFILE_MEDIA_*  CURSOR_SET_*
PROJECT_CREATED|UPDATED|DELETED|PUBLISHED|UNPUBLISHED  CATEGORY_*  CATEGORY_REASSIGNED  LINK_*
REORDERED
ROTATION_OVERRIDE_SET  ROTATION_OVERRIDE_CLEARED  ROTATION_RESELECTED
INTEGRATION_UPDATED  INTEGRATION_SECRET_UPDATED  INTEGRATION_CONNECTED  INTEGRATION_DISCONNECTED  INTEGRATION_TESTED
CONTACT_MESSAGE_UPDATED  CONTACT_MESSAGE_DELETED  CONTACT_REPLY_LINK_OPENED  CONTACT_RETENTION_PURGED
TEMPLATE_UPDATED  TEMPLATE_RESET  LEGAL_UPDATED  FEATURE_TOGGLED  JOB_TRIGGERED  TECH_STACK_TOGGLED
TECH_STACK_ITEM_CREATED  TECH_STACK_ITEM_UPDATED  TECH_STACK_ITEM_DELETED
AUDIT_EXPORTED
```

Metadata yalnızca **değişen alan adlarını** içerir; değerler yalnızca allowlist'teki güvenli alanlar için (`isActive`, `isPublished`, `sortOrder`, `title`, `role`, `permissions`). Redaction SRS FR-AUD-03.

---

## 7. Test standartları

| Katman | Araç | Kural |
|---|---|---|
| Saf fonksiyonlar (rotasyon seçimi, URL doğrulama, normalizeKey, şablon motoru) | Vitest | %100 dal kapsamı |
| Servisler | Vitest + test DB (Docker, her test dosyası transaction rollback) | ≥ %80 |
| API | Supertest | Her endpoint için: mutlu yol, doğrulama hatası, yetkisiz (401), yetkisi yok (403) |
| Bileşenler | Vitest + Testing Library | Kritik: PlayerBar, LinksSection, UploadField, WelcomeOverlay |
| E2E | Playwright | TODO.md'deki akışlar; görsel regresyon Linkler bölümü için |
| a11y | `@axe-core/playwright` | Kritik/ciddi ihlal = test hatası |

- Testler ağdan bağımsızdır; dış servisler `msw` (frontend) / `nock` (backend) ile taklit edilir.
- Zaman bağımlı testler sahte saat kullanır (`vi.useFakeTimers`, `vi.setSystemTime`) ve Europe/Istanbul gün sınırını (20:59:59Z ↔ 21:00:00Z) test eder.
- Test adı davranışı anlatır: `it('7 link varken ikinci satırdaki tek kartı ortalar')`.

---

## 8. Tasarım sistemi kuralları

> Yön ve his: PRD.md §6 ("Gece Camı"). Burada **uygulanabilir değerler** tanımlıdır. Bileşenler renk/ölçü değerini doğrudan yazmaz; yalnızca token kullanır.

### 8.1 Renk token'ları (OKLCH)

`frontend/src/styles/globals.css` içinde `:root[data-theme=…]` altında CSS değişkeni, Tailwind v4 `@theme inline` ile yardımcı sınıflara bağlanır (`bg-surface`, `text-muted` vb.).

| Token | Dark | Light | Kullanım |
|---|---|---|---|
| `--bg` | `oklch(0.14 0.02 275)` | `oklch(0.975 0.006 275)` | Sayfa zemini (sahne yoksa) |
| `--surface` | `oklch(0.19 0.02 275)` | `oklch(1 0 0)` | Kart, panel (Classic) |
| `--surface-2` | `oklch(0.23 0.025 275)` | `oklch(0.955 0.01 275)` | İç içe yüzey, input |
| `--glass` | `oklch(0.19 0.02 275 / 0.55)` | `oklch(1 0 0 / 0.62)` | Glass yüzey |
| `--border` | `oklch(1 0 0 / 0.10)` | `oklch(0.22 0.03 275 / 0.12)` | Kenarlık |
| `--border-strong` | `oklch(1 0 0 / 0.18)` | `oklch(0.22 0.03 275 / 0.22)` | Hover/aktif kenarlık |
| `--text` | `oklch(0.96 0.008 275)` | `oklch(0.22 0.03 275)` | Birincil metin |
| `--text-muted` | `oklch(0.74 0.02 275)` | `oklch(0.46 0.03 275)` | İkincil metin |
| `--accent` ("iris") | `oklch(0.74 0.15 285)` | `oklch(0.52 0.19 285)` | Vurgu, link, odak |
| `--accent-fg` | `oklch(0.17 0.03 285)` | `oklch(0.99 0 0)` | Vurgu üstü metin |
| `--accent-glow` | `oklch(0.74 0.15 285 / 0.35)` | `oklch(0.52 0.19 285 / 0.22)` | Parlama, hover gölgesi |
| `--success` | `oklch(0.74 0.16 152)` | `oklch(0.55 0.15 152)` | Başarı |
| `--warning` | `oklch(0.83 0.15 85)` | `oklch(0.62 0.14 70)` | Uyarı |
| `--danger` | `oklch(0.66 0.2 25)` | `oklch(0.55 0.2 25)` | Hata, yıkıcı |
| `--status-online` | `oklch(0.74 0.17 150)` | aynı | Discord online |
| `--status-idle` | `oklch(0.82 0.16 85)` | aynı | idle |
| `--status-dnd` | `oklch(0.64 0.21 25)` | aynı | dnd |
| `--status-offline` | `oklch(0.62 0.02 275)` | aynı | offline |
| `--scrim` | `linear-gradient(180deg, oklch(0.1 0.02 275 / 0.55), oklch(0.1 0.02 275 / 0.82))` | `linear-gradient(180deg, oklch(0.98 0.005 275 / 0.6), oklch(0.98 0.005 275 / 0.85))` | Sahne üstü örtü |
| `--scene-fallback` | `radial-gradient(120% 80% at 50% 0%, oklch(0.3 0.08 285), oklch(0.14 0.02 275))` | `radial-gradient(120% 80% at 50% 0%, oklch(0.9 0.05 285), oklch(0.975 0.006 275))` | Arka plan yoksa |

Kurallar:
- Metin/zemin kontrastı ≥ 4.5:1; `--text-muted` yalnızca ≥ 14 px metinde. Yeni token eklenirken iki temada kontrast ölçülür ve bu tabloya yazılır.
- Durum bilgisi **yalnızca renkle** verilmez: Discord durum noktası yanında metin etiketi ("Çevrimiçi") veya `aria-label`.
- Tek vurgu rengi kuralı: `--accent` dışında dekoratif renk eklenmez. İsim efekti gradyanı `--accent` → `oklch(0.78 0.14 330)` ("orkide") ile sınırlıdır.

**Tailwind / shadcn adlandırması (F4'te uygulandı):** CSS değişkenleri yukarıdaki adlarla kalır; Tailwind sınıfları shadcn semantiğini izler. Bu yüzden marka rengi sınıfta `primary` adını taşır, `accent` ise shadcn anlamıyla hover/seçili nötr zemindir:

| Sınıf | Kaynak değişken | Kullanım |
|---|---|---|
| `bg-primary` / `text-primary` / `text-primary-foreground` | `--accent` / `--accent-fg` | Birincil buton, link, odak, aktif ikon |
| `bg-primary-soft` | `--accent-soft` | Aktif menü öğesi, bilgi kutusu |
| `bg-accent` / `text-accent-foreground` | `--surface-2` / `--text` | Hover ve seçili zemin (menü, ghost buton) |
| `text-muted-foreground` / `bg-muted` | `--text-muted` / `--surface-2` | İkincil metin / sessiz zemin |
| `bg-card`, `bg-popover`, `bg-surface-2/3` | `--surface`, `--surface-2/3` | Kart, açılır menü, iç içe yüzey |
| `bg-background` / `text-foreground` | `--bg` / `--text` | Sayfa |
| `border`, `border-border-strong`, `ring` | `--border`, `--border-strong`, `--accent` | Kenarlık ve odak |
| `surface-chrome` (bileşen sınıfı) | `--chrome-bg` + `--chrome-blur` | Navbar, sidebar, topbar, giriş kartı — Glass/Classic/düşük efekt otomatik |
| `type-hero`, `type-h1..h3`, `type-meta`, `type-eyebrow` | §8.3 | Tipografi rolleri |

**Kontrast ölçümü (F4, OKLCH → sRGB, WCAG):**

| Çift | Koyu | Açık |
|---|---|---|
| text / bg | 17.7 | 16.2 |
| muted / surface-2 | 7.3 | 6.3 |
| accent-fg / accent (buton) | 7.9 | 5.8 |
| accent / bg (link) | 8.3 | 5.5 |
| danger / surface | 5.4 | 5.4 |
| success / surface | 8.6 | 4.5 |
| warning / surface | 10.9 | **3.75** |

Açık temada `--warning` metin için 4.5:1'in altında: yalnızca ikon ve UI işaretlerinde (≥ 3:1) kullanılır; uyarı **metni** her zaman `text-foreground` ile yazılır.

- `autoFocus` kullanılmaz (`jsx-a11y/no-autofocus`); diyaloglar odağı Radix ile ilk alana taşır.
- shadcn bileşenleri `npx shadcn add` ile eklenir; ardından `import { cn } from "@/lib/utils"` yolu ve kullanılmayan `React` import'u kontrol edilir (CLI bu projede ikisini de hatalı üretti).

### 8.2 Yüzey modları

| Mod | Kart/panel | Navbar | Not |
|---|---|---|---|
| Classic | `bg-surface`, `border` | `bg-bg` (opak) | Varsayılan düşük donanım dostu |
| Glass | `bg-glass` + `backdrop-blur-[16px] backdrop-saturate-[1.4]` + `border` + iç parlama `inset 0 1px 0 oklch(1 0 0 / 0.06)` | aynı cam | Şartname §14.2 |
| Glass + effects=low | Classic'e düşer | Classic | `backdrop-filter` maliyeti önlenir |

`backdrop-filter` aynı anda en fazla ~8 görünür yüzeyde kullanılır (performans); uzun listelerde (wallpaper grid) kartlar cam değil `surface`'tir, yalnızca bölüm konteyneri camdır.

### 8.3 Tipografi

| Rol | Font | Boyut | Ağırlık | Satır yüksekliği | Not |
|---|---|---|---|---|---|
| Hero isim | Bricolage Grotesque Variable | `clamp(2.75rem, 1.8rem + 4.5vw, 5rem)` | 700 | 1.0 | `letter-spacing: -0.03em`, `text-wrap: balance` |
| Bölüm başlığı (h2) | Bricolage Grotesque | `clamp(1.5rem, 1.2rem + 1.2vw, 2.125rem)` | 650 | 1.15 | `-0.02em` |
| Kart başlığı (h3) | Geist Variable | `1.0625rem` | 600 | 1.3 | |
| Gövde | Geist | `1rem` | 400 | 1.6 | Okuma genişliği ≤ 68ch |
| Küçük | Geist | `0.875rem` | 400–500 | 1.5 | |
| Meta / zaman / sayaç | Geist Mono Variable | `0.8125rem` | 500 | 1.4 | `font-variant-numeric: tabular-nums` |
| Admin gövde | Geist | `0.9375rem` | 400 | 1.5 | Daha yoğun |

- Fontlar `@fontsource-variable/*` ile self-host; `font-display: swap`; yalnızca `latin` + `latin-ext` alt kümeleri (Türkçe karakterler için `latin-ext` zorunlu).
- Fallback yığını metrik uyumlu: `"Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Başlıklar `text-wrap: balance`, paragraflar `text-wrap: pretty`.

### 8.4 Boşluk, ızgara, köşe, gölge

- **Boşluk ölçeği** (4 px tabanlı): 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64, 20=80, 24=96. Tailwind varsayılanıyla aynı; ara değer (ör. `p-[13px]`) **kullanılmaz**.
- Bölümler arası dikey boşluk: mobil 64 px, masaüstü 96 px. Bölüm başlığı → içerik: 24 px.
- İçerik genişliği: `max-w-[1200px]` + yatay padding mobil 16, tablet 24, masaüstü 32. Linkler bölümü `max-w-[1280px]`.
- **Köşe yarıçapı:** `--radius-sm 8px` (input, rozet), `--radius-md 12px` (buton, küçük kart), `--radius-lg 16px` (kart), `--radius-xl 24px` (bölüm paneli, modal), `full` (avatar, durum noktası). İç içe öğede iç yarıçap = dış yarıçap − padding.
- **Gölge:** dark temada gölge yerine kenarlık + parlama tercih edilir; `--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.2)`, `--shadow-lg: 0 12px 32px -8px oklch(0 0 0 / 0.45)`, hover parlaması `0 0 0 1px var(--border-strong), 0 8px 24px -6px var(--accent-glow)`.
- **Z-index ölçeği:** sahne 0, içerik 10, navbar 40, oynatıcı 45, cookie banner 50, modal/sheet 60, toast 70, welcome overlay 80.

### 8.5 Hareket (Framer Motion)

| Token | Değer | Kullanım |
|---|---|---|
| `duration.fast` | 150 ms | Hover, renk |
| `duration.base` | 220 ms | Buton, toggle, menü |
| `duration.slow` | 400 ms | Modal, sheet, bölüm girişi |
| `duration.enter` | 600 ms | Welcome çıkışı, hero girişi |
| `ease.out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Girişler |
| `ease.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Konum değişimleri |
| `spring.soft` | `{ type: 'spring', stiffness: 260, damping: 30 }` | Sürükle-bırak, layout |
| `stagger` | 40 ms | Liste öğe girişleri (maks. 8 öğe; sonrası anında) |

Kurallar:
- Yalnızca `transform` ve `opacity` (ve gerekirse `filter: blur` — yalnızca Welcome) animasyonlanır.
- Bölüm girişleri `whileInView` ile bir kez (`viewport: { once: true, amount: 0.2 }`); y ofseti 12 px, opacity 0→1.
- `effects=low` veya `prefers-reduced-motion`: `MotionConfig reducedMotion="always"`; yalnızca opacity geçişleri (≤ 150 ms) kalır; parçacık/yıldız/arka plan videosu kapalı.
- Sonsuz animasyonlar (yıldız parıltısı, parçacıklar, ekolayzer çubukları) sekme gizliyken (`visibilitychange`) durur ve görünüm dışındayken çalışmaz.
- Hiçbir anlam yalnızca hareketle iletilmez.

### 8.6 Bileşen tarifleri (özet)

| Bileşen | Tarif |
|---|---|
| **Navbar** | Yükseklik 64 px, sticky, `rounded-xl` yüzen kapsül (masaüstünde sayfa kenarından 12 px içeride), sol: başlık (Bricolage 600), orta: linkler (aktif link alt çizgi değil, `surface-2` hap), sağ: tema / yüzey / efekt ikon butonları (Tooltip'li). Mobilde başlık + menü butonu. |
| **Hero** | Profil 144 px (mobil 112) yuvarlak, 3 px `--border-strong` halka + Discord durum noktası (sağ alt, 22 px, 3 px zemin rengi çerçeve). Altında isim (h1), slogan (`text-muted`), konum (Lucide `MapPin` + metin). Dikey ritim: 16 / 8 / 4 px. |
| **İsim efektleri** | NEON: `text-shadow: 0 0 6px var(--accent-glow), 0 0 18px var(--accent-glow), 0 0 42px var(--accent-glow)` (statik). GRADIENT: `background: linear-gradient(100deg, var(--text), var(--accent) 45%, oklch(0.78 0.14 330)); background-clip: text; color: transparent` (statik). PARTICLES: isim kutusunun etrafında `<canvas>`, ≤ 36 parçacık, yavaş yukarı süzülme, DPR ≤ 2. STARS: 6 adet 4 köşeli SVG yıldız, sabit konumlar, 2.4–4 sn arası rastgele faz ile opacity/scale parıltısı. Birlikte seçilebilir; NEON+GRADIENT birlikte → gradyan metin + `filter: drop-shadow` ile neon. |
| **PlayerBar** | Cam şerit, yükseklik 72 px (mobil 64), `rounded-xl`. Sol: 48 px kapak (`rounded-md`), başlık (1 satır, taşarsa kaydırmalı marquee **değil** — `text-overflow: ellipsis`), sanatçı. Orta: ±5 / oynat (44 px, `--accent` dolgu) butonları + ilerleme çubuğu (4 px, hover'da 6 px, `--accent` dolgu). Sağ: süre (mono), ses ikonu + kaydırıcı (masaüstü). Çalarken kapak üzerinde 3 çubuklu mini ekolayzer (effects=low'da statik). |
| **Durum kartı** | `rounded-lg`, 20 px padding, üstte servis logosu (React Icons) + servis adı (meta stilinde) + son güncelleme; gövde servis özelinde. Yükseklikler eşit (bento). Skeleton aynı yapıda. Hata: soluk ikon + "Şu anda alınamıyor". |
| **Link kartı** | Yükseklik 64 px, `rounded-md`, `[görsel 40×40 rounded-sm][12 px][başlık 1 satır ellipsis]`, 12 px iç boşluk; hover: `translateY(-2px)` + parlama gölgesi + `--border-strong`. Odak: 2 px `--accent` halka, 2 px offset. |
| **Proje kartı** | 16:10 kapak (`rounded-md` iç), başlık h3, 2 satır özet (`line-clamp-2`), kategori çipleri (maks. 3 + "+n"). Kartın tamamı link. |
| **Medya kartı (indirme)** | Sabit oran (wallpaper 16:9, pfp 1:1), alt kısımda başlık + İndir butonu (ikon `Download` + "İndir"); video kartında sağ üstte küçük "MP4" rozeti. |
| **Welcome overlay** | `oklch(0 0 0 / 0.72)` + `backdrop-blur-sm`, merkezde metin (Geist Mono, `0.9375rem`, harf aralığı 0.08em, imleç yanıp sönme `▍` — effects=low'da sabit). |
| **Cookie banner** | Alt-orta yüzen kart, maks. genişlik 560 px, içeriği kapatmaz (`bottom: 16px`, oynatıcı varsa onun üstünde), üç eşit buton. |
| **Admin tablo** | Satır yüksekliği 52 px, zebra yok, hover `surface-2`, sticky başlık, sağda eylem menüsü (`MoreHorizontal`). |

### 8.7 Durum (state) desenleri

| Durum | Public | Admin |
|---|---|---|
| Yükleniyor | Gerçek ölçülü skeleton, `animate-pulse` (effects=low'da statik) | Aynı; tablo için 8 satır skeleton |
| Boş | Çoğu bölüm render edilmez; sayfa seviyesinde `EmptyState` (ikon + 1 cümle + eylem) | `EmptyState` + birincil eylem butonu |
| Hata | Bölüm içi `ErrorState` (ikon + "Şu anda yüklenemedi" + "Tekrar dene"), bölüm yüksekliği korunur | Toast + satır/alan içi hata |
| Başarılı | İçerik `whileInView` girişiyle | Toast "… kaydedildi." |

### 8.8 Responsive kuralları

- Mobile-first yazılır (`base` → `sm` → `md` → `lg` → `xl`).
- 320 px'te yatay scroll yok: `overflow-x: clip` **çözüm değildir**, taşma kaynağı düzeltilir.
- Dokunma hedefleri ≥ 44×44 px; ikon butonlar 40 px görsel + görünmez genişletilmiş alan.
- Hover'a bağlı işlev yok; hover efektleri `@media (hover: hover)` içinde.
- `100vh` yerine `100dvh`.

---

## 9. Git ve inceleme

- Dal: `main` (korumalı) ← `feat/<kısa-ad>`, `fix/…`, `docs/…`, `chore/…`.
- Commit: Conventional Commits (`feat(links): son satır ortalama`), Türkçe veya İngilizce özet, gövdede "neden".
- PR şablonu: Ne değişti · Hangi doküman güncellendi · Test kanıtı (komut çıktısı/ekran görüntüsü) · Güvenlik etkisi · Ekran görüntüsü (UI değişikliğinde iki tema).
- Merge şartları: CI yeşil, en az bir inceleme (tek geliştirici ise kendi kontrol listesi), çözülmemiş yorum yok.
- `main`'e doğrudan push ve `--no-verify` **YASAK**.

---

## 10. Hızlı kontrol listesi (her PR)

- [ ] `.ts/.tsx` yok; yalnızca JS/JSX
- [ ] İlgili `/docs` güncellendi
- [ ] Girdi Zod ile doğrulandı (istemci + sunucu aynı şema)
- [ ] Raw SQL yok veya yalnızca tagged template
- [ ] `dangerouslySetInnerHTML` yok
- [ ] Yeni admin uç noktası `requireAuth` + `requirePermission` arkasında ve audit üretiyor
- [ ] Secret/kişisel veri loglanmıyor, yanıtlara girmiyor
- [ ] Yükleniyor / boş / hata / başarılı durumları var
- [ ] Renk ve ölçüler token'dan; iki tema × iki yüzey kontrol edildi
- [ ] Klavye ve reduced-motion ile denendi
- [ ] Testler eklendi ve yeşil
