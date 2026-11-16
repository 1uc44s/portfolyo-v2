# SRS — Software Requirements Specification

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · **Bağlı:** PRD.md, Şartname
> Gereksinim anahtar kelimeleri: **ZORUNLU** (MUST), **GEREKLİ** (SHOULD), **OPSİYONEL** (MAY).

---

## 1. Giriş

### 1.1 Amaç
Bu doküman, PRD'deki ürün hedeflerini test edilebilir yazılım gereksinimlerine çevirir. Her gereksinimin bir kimliği vardır (`FR-xxx`, `NFR-xxx`, `SEC-xxx`) ve TODO.md test adımları bu kimliklere referans verir.

### 1.2 Sistem bağlamı

```
[Tarayıcı] ──HTTPS──> [Reverse proxy (Caddy/Nginx)] ──> /         → frontend statik build (Vite)
                                                      ├─> /api/*    → Express API (Node)
                                                      └─> /media/*  → Express medya sunucusu
[Express API] ──> PostgreSQL (Prisma)
             ├──> Dosya deposu (yerel kalıcı disk veya S3 uyumlu)
             ├──> Discord Gateway (discord.js bot)
             ├──> Spotify Web API (OAuth2)
             ├──> GitHub REST API + istatistik görsel servisi (proxy)
             ├──> SMTP (admin tanımlı)
             └──> CAPTCHA doğrulama (Cloudflare Turnstile)
```

Frontend ve API **aynı origin** altında sunulur (cookie, CSRF ve CORS yönetimini basitleştirir). Geliştirmede Vite proxy aynı davranışı taklit eder.

### 1.3 Teknoloji kararları (Şartname §2'den sabitlenen)

| Katman | Karar | Not |
|---|---|---|
| Dil | **JavaScript (ESM) + JSX** | TypeScript **yasak** (kaynakta `.ts/.tsx` yok) |
| Frontend | React 19, Vite, React Router (declarative mode) | SPA |
| Stil | TailwindCSS v4 (`@tailwindcss/vite`) | Token'lar CSS değişkeni |
| UI | shadcn/ui (`components.json` → `"tsx": false`) | Bileşenler JSX olarak üretilir |
| İkon | Lucide React (birincil), React Icons (yalnızca marka ikonları: Discord, Spotify, GitHub vb.) | Aynı ikon iki kütüphaneden kullanılmaz |
| Animasyon | **Framer Motion** (`motion` paketi, `motion/react`) | AnimeJS **kullanılmaz** |
| Veri çekme | TanStack Query | Cache, retry, durum ayrımı |
| İstemci durumu | Zustand (player, tercihler, auth token) | |
| Form | react-hook-form + Zod | |
| HTTP istemci | axios (upload progress + interceptor) | |
| Backend | Node.js 24 LTS, Express 5 | |
| ORM / DB | Prisma (JS istemcisi) / PostgreSQL 17 | |
| Doğrulama | Zod (paylaşılan şemalar `packages/shared`) | |
| Parola | Argon2id (`argon2`) | |
| Görsel işleme | Sharp | WebP, EXIF temizleme, thumbnail |
| Video işleme | FFmpeg (`fluent-ffmpeg` veya `child_process.spawn`) | Sistem binary'si |
| Dosya imzası | `file-type` | Magic bytes |
| Cron | `node-cron` (timezone: `Europe/Istanbul`) | |
| 2FA | Kendi RFC 6238 TOTP uygulaması (`node:crypto`, RFC test vektörleriyle doğrulanır) + `qrcode` | Adım bazlı replay kontrolü için harici kütüphane kullanılmadı |
| JWT | `jose` (HS256) | |
| Şifre gücü | `@zxcvbn-ts/core` + `language-common` | Skor ≥ 3 |
| E-posta | `nodemailer` | |
| Log | `pino` + `pino-http` (redaction) | |
| Rate limit | `rate-limiter-flexible` | v1 bellek; çoklu instance'ta Redis |
| Güvenlik header | `helmet` | CSP dahil |
| Markdown | Frontend: `react-markdown` + `rehype-sanitize` (raw HTML kapalı) | |
| CAPTCHA | Cloudflare Turnstile | Çerezsiz, KVKK dostu |

---

## 2. Fonksiyonel gereksinimler — Public

### 2.1 Genel

- **FR-PUB-01** Public sayfalar yalnızca `/api/public/*` verisiyle çizilir; içerik sabit kodlanmaz (istisna: sistem metinleri, Tech Stack placeholder). ZORUNLU
- **FR-PUB-02** Navbar ve footer tüm public sayfalarda ortaktır ve tek bir `PublicLayout` içinde render edilir. ZORUNLU
- **FR-PUB-03** İçeriği olmayan bölüm DOM'a eklenmez: Projeler (yayında proje yok), Hakkımda (gövde boş), Linkler (aktif link yok), her durum kartı (entegrasyon kapalı). ZORUNLU
- **FR-PUB-04** Tech Stack bölümü, `SiteSettings.techStackPublished = false` iken yalnızca başlık (`Tech Stack`) + `Coming soon` gösterir; kart/ikon/logo içermez. Konum: Durumlar'ın altı, Projeler'in üstü. ZORUNLU (2026-11-15: metin kullanıcı kararıyla `Yakında...` → `Coming soon`; gerçek içerik F21'de, en son)
- **FR-PUB-04B** (F21) `techStackPublished = true` iken bölüm ROADMAP F21 tasarımıyla çizilir: halka düzeninde N (3–9) öğe, otomatik sıra numarası, merkezde 3 satırlık başlık (amblem yok — 2026-11-16 kaldırıldı). Dar ekranda (< 768 px) alt alta liste (numaralı daire + etiket + açıklama, dikey ray). Hover/odakta daire, numara ve etiket birlikte büyür, dairede ışıltı; alt çizgi yok. Öğe bir `<button>`; tıklama/Enter açıklamayı açılır kartta (Popover) gösterir, Escape kapatır; açıklama düz metin (HTML yok). Görsel yoksa baş harf. Veri `GET /api/public/tech-stack`; bölüm lazy chunk. Etiket ve açıklama yalnızca adminden gelir.
- **FR-PUB-05** Her veri bağımlı bileşen dört durumu ayırır: `loading` (skeleton), `empty`, `error`, `success`. ZORUNLU
- **FR-PUB-06** Bir bileşenin hatası, Error Boundary ile o bileşenle sınırlanır; sayfa çökmez. ZORUNLU

### 2.2 Navbar (Şartname §3.2)

- **FR-NAV-01** Navbar başlığı `SiteSettings.navbarTitle`'dan gelir.
- **FR-NAV-02** Linkler: Portfolyo, Duvar Kağıtları, Profil Fotoğrafları; tema (Dark/Light) ve görünüm (Glass/Classic) kontrolleri; düşük efekt modu anahtarı (ayarlar menüsü içinde).
- **FR-NAV-03** "Duvar Kağıtları" yalnızca `GET /api/public/site` yanıtındaki `nav.wallpapers = true` iken; "Profil Fotoğrafları" yalnızca `nav.pfps = true` iken gösterilir. Bu bayraklar backend'de hesaplanır: duvar kağıdı `EXISTS(background: isActive AND isWallpaper AND READY)`, pfp `EXISTS(isActive AND isDownloadable)`. Ayrı duvar kağıdı yükleme alanı yoktur (2026-11-16).
- **FR-NAV-05** Ada navbar giriş animasyonu (2026-11-16): karşılama ekranı kapanınca (ya da ekran gösterilmiyorsa sayfa açılışında) navbar yukarıdan aşağı kayarak (≈ 700 ms, `ease-out-expo`) ve belirerek yerine iner. Düşük efekt / azaltılmış harekette yalnızca belirir.
- **FR-NAV-04** Mobilde navbar, erişilebilir bir menüye (shadcn `Sheet`) dönüşür; focus trap ve Escape ile kapanma.

### 2.3 Welcome overlay (Şartname §4.1)

- **FR-WEL-01** Her oturumda (sekme ömrü, `sessionStorage`) ilk ziyarette gösterilir. Aynı sekmede sayfa geçişlerinde tekrar gösterilmez.
- **FR-WEL-02** Tam ekran, otomatik odak alır. Önce **bağlanma** aşaması (FR-WEL-06), ardından `role="button"` + `tabIndex=0` olur ve Click / Enter / Space ile kapanır. Bağlanma bitmeden tıklama/tuş yok sayılır.
- **FR-WEL-07** (2026-11-16) Karşılama ekranı açık olduğu sürece (bağlanma dahil) navbar, profil fotoğrafı, durum kartları ve diğer tüm bileşenler gizlidir (`inert`); yalnızca sahne arka planı ve karşılama metni (küçük koyu kutu) görünür. Bağlanırken sahne hafifçe karartılır. Tıklayınca bileşenler belirir, navbar iner.
- **FR-WEL-06** Bağlanma aşaması (2026-11-16): `Connecting` + noktalar 400 ms'de bir `.` → `..` → `...` → `..` → `.` (genişlik sabit, metin kaymaz). Altında uzun ilerleme çubuğu (`role="progressbar"`, yüzde metni): 0 → %99 **3 sn** (yavaşlayan eğri), %99 → %100 **2 sn** (toplam 5 sn). %100 olunca animasyonla `Successfully Connected!`, alt satırda `Welcome! Please click anywhere...` (harf harf yazılır) ve sonunda giriş alanlarındaki gibi yanıp sönen ince imleç. Bu satır göründükten sonra tıklama/Enter/Space siteye girer (FR-WEL-04). Azaltılmış harekette yazı efekti ve imleç yanıp sönmesi yok, çubuk yine 5 sn'de dolar.
- **FR-WEL-03** Kapanma: opacity 1→0 + blur 0→8 px, 600 ms (`ease-out-expo`). Düşük efekt modunda 150 ms opacity.
- **FR-WEL-04** Kapanma olayı içinde (aynı kullanıcı jesti) `audio.play()` çağrılır. İlk defa ise `volume = 0.6`; `localStorage.playerVolume` varsa o değer. `localStorage.playerPaused = true` ise çalma başlatılmaz.
- **FR-WEL-05** `play()` reddedilirse (NotAllowedError) sessizce yutulur; oynatıcı "Oynat" durumunda kalır.

### 2.4 Hero (Şartname §4.2)

- **FR-HERO-01** Alanlar: profil görseli, isim, slogan, konum, isim efektleri (çoklu: `NEON`, `GRADIENT` hareketsiz gradyan, `GRADIENT_ANIMATED` soldan sağa akan gradyan, `OVERLAY` isim GIF katmanı) ve gradyan renkleri `gradientFrom` (sol) / `gradientTo` (sağ), `#RRGGBB`. PARTICLES ve STARS kaldırıldı (2026-11-16). İki gradyan türü aynı renkleri kullanır ve birlikte seçilemez.
- **FR-HERO-02** Profil görseli: `HeroSettings.profileMode = ROTATION` ise günün PFP seçimi; `FIXED` ise `fixedProfileMediaId`. İkisi de yoksa isim baş harfli avatar.
- **FR-HERO-03** Efektler birleştirilebilir. `GRADIENT_ANIMATED` CSS `background-position` animasyonudur (`.name-gradient-animated`); yalnızca renk akışı olduğu için düşük efekt modunda ve `prefers-reduced-motion`'da da akar (2026-11-16 kullanıcı isteği). NEON ve GRADIENT statik CSS.
- **FR-HERO-05** İsim Efekti (GIF katmanı, `OVERLAY`; arayüzde "İsim Efekti"): admin "Medya > İsim efektleri" sekmesinden yalnızca **GIF** yükler (şeffaf zeminli parçacık vb., ≤ 10 MB). Kayıtlar Aktif + Rotasyonda anahtarlı; günlük rotasyon kategorisi `NAME_OVERLAY` (FR-ROT ile aynı kurallar, elle seçim/override dahil). `OVERLAY` efekti seçiliyse günün GIF'i ismin **üstünde**, isim kutusunu kaplayacak şekilde (`object-fit: cover`, `pointer-events: none`, `aria-hidden`) gösterilir. Düşük efekt modunda gösterilmez. Public indirme sayfası yoktur.
- **FR-HERO-04** İsim `<h1>` olarak render edilir; efekt katmanları `aria-hidden="true"`.

### 2.4b Hareketli sekme başlığı ve yağan öğeler (2026-11-16)

- **FR-TAB-01** Public sayfalarda sekme başlığı `navbarTitle`'dan harf harf yazılıp silinir (1 sn adım: `l`, `la`, `lan`, `la`, `l`, …; en az 1 harf). Her döngüde sona listeden rastgele bir emoji eklenir (`crypto.getRandomValues`). Liste: 😎🥰😍🤩😪😴🤑😖🤯🥸👻👽👾💀☠️🙈🙉🙊🐱🐶🦊🐨🐼🐣👀✨🎈🎃🎀👑🍥🍩🍻🥂♨️🌇🌆⭐🌀⚡🌠☄️🔥❤️‍🩹❤️‍🔥💝💖💫♾️💭. Sayfaya özel başlığı olan sayfalar (proje detayı, indirme, yasal) kendi başlığını kullanır.
- **FR-FALL-01** "Yağan öğeler" (`FallingItem`, CRUD + sıralama, en fazla 20): her öğe ya **görsel** (PNG/WEBP/GIF, ≤ 1 MB, ≤ 256×256) ya da **metin** (emoji, harf, sayı; 1–8 karakter). Boyut 12–64 px. Aktif öğelerin hepsi birlikte, public sayfalarda yukarıdan aşağı yağar (tıklamayı engellemez, `aria-hidden`).
- **FR-FALL-02** Toplam en fazla 30 tanecik, öğelere eşit dağıtılır; süre/gecikme/salınım tohumlu sözde rastgele (deterministik). Düşük efekt modunda ve `prefers-reduced-motion`'da çalışmaz.

### 2.4c 404 sayfası — TON 618 (2026-11-16)

- **FR-404-01** Bilinmeyen public yol (`*`) tam ekran, **menüsüz** sayfa: navbar, footer, oynatıcı, çerez bandı ve karşılama ekranı yok. Arka plan `/ton-618.mp4` (sessiz, döngü, `playsInline`, `aria-hidden`); kara delik solda kalsın diye video yatay aynalanır. Web için 1080p/30 fps kopya (`/ton-618-1080.mp4`) varsayılan; ≥ 2400 px ekranlarda 4K orijinal. Poster karesi `/ton-618-poster.webp`.
- **FR-404-02** Yerleşim (dosya/dossier tasarımı): üstte ortada geniş harf aralıklı `- 404 -` (h1 erişilebilir adı "Sayfa bulunamadı"), sağda TON 618 bilgi sütunu (simge, başlık, ince çizgi, ortalanmış küçük alt başlıklar ve iki yana yaslı kısa metinler: Nedir, Kütle, Olay ufku, Işık, Uzaklık, Keşif), altta ortada "Ana sayfaya dön" bağlantısı. Sağ sütunun arkasında yalnızca okunurluk için sağdan sola koyulaşan gradyan (tüm sayfaya örtü yok). Mobilde bilgi sütunu altta, kaydırılabilir.
- **FR-404-03** WCAG 2.2.2: video için duraklat/oynat düğmesi (sağ alt, `aria-pressed`). Video her durumda (düşük efekt / azaltılmış hareket dahil, kullanıcı isteği) hareketli başlar; düğmeyle durdurulabilir. Sayfa **kaydırılmaz** (`h-dvh`, taşma gizli): yazı boyutları ekran yüksekliğine göre ölçeklenir; dar ekranda uzun bölümler yerine 2×2 özet (kütle, olay ufku, uzaklık, parlaklık). Sayfa açılırken global müzik çalıyorsa duraklatılır (oynatıcı arayüzü yok).
- **FR-404-04** `/projects/:slug` bulunamadığında site içinde gömülü 404 (navbar/footer korunur) kalır.

### 2.5 Global müzik oynatıcı (Şartname §4.3)

- **FR-PLY-01** Uygulamada tek `<audio>` elemanı, router'ın dışında (`AppShell` seviyesinde) bulunur.
- **FR-PLY-02** Kontroller: kapak, başlık, sanatçı, −5 sn, oynat/durdur, +5 sn, ses kaydırıcısı (+ sessiz), ilerleme kaydırıcısı (seek), geçen/toplam süre (`m:ss`, Geist Mono, `tabular-nums`).
- **FR-PLY-03** Klavye: kaydırıcılar ok tuşlarıyla (seek 5 sn, ses %5). Butonların `aria-label`'ı vardır. Kaydırıcılar yerel `<input type="range">` (ek kütüphane yok, public JS bütçesi); `aria-valuetext` okunur süre/yüzde verir. Oynatıcı tüm public sayfalarda `PublicLayout` altında yüzen şerittir; içeriğin altına eşit yükseklikte boşluk bırakılır.
- **FR-PLY-04** Durumlar: veri gelirken skeleton; aktif müzik yoksa oynatıcı render edilmez; `error` olayında "Müzik yüklenemedi" + tekrar dene.
- **FR-PLY-05** Kalıcı tercihler (`localStorage`): `playerVolume` (0–1), `playerMuted`, `playerPaused`. Şarkının konumu saklanmaz (günlük seçim değişebilir).
- **FR-PLY-06** Parça sona erince `loop = true` ile başa döner (tek günlük parça).
- **FR-PLY-07** `preload="metadata"`; ses dosyası Welcome geçilmeden indirilmez.
- **FR-PLY-08** Media Session API ile işletim sistemi medya kontrollerine başlık/kapak/play/pause/seek bildirilir. GEREKLİ. Desteklenmeyen tarayıcıda sessizce atlanır; `seekbackward`/`seekforward` 5 sn, `seekto`, `setPositionState` (en fazla saniyede bir).
- **FR-PLY-09** Süre, `loadedmetadata` gelene kadar API'deki `durationMs` ile gösterilir; `audio.duration` gelince o kullanılır.

### 2.6 Durum kartları (Şartname §5) — bkz. §4 Entegrasyonlar

### 2.7 Projeler (Şartname §7)

- **FR-PRJ-01** `GET /api/public/projects` yalnızca `isPublished = true` projeleri `sortOrder ASC, id ASC` sırasıyla döndürür; kapak görseli, başlık, kısa açıklama (ilk 160 karakter, düz metin), kategoriler (yalnızca aktif kategoriler).
- **FR-PRJ-02** `/projects/:slug` detay: tüm görseller (galeri + lightbox), Markdown açıklama, kategoriler, demo/video/GitHub linkleri.
- **FR-PRJ-03** Detay sayfası görüntülendiğinde ve analitik izni varsa `PROJECT_VIEW` olayı gönderilir; aynı ziyaretçi + proje için günde bir sayım.
- **FR-PRJ-04** Bilinmeyen/yayında olmayan slug → API `404`, frontend `NotFound` ekranı.

### 2.8 Hakkımda (Şartname §8)

- **FR-ABT-01** Başlık + Markdown gövde. Raw HTML render edilmez; `rehype-sanitize` varsayılan şeması; linklere `rel="noopener noreferrer"` eklenir, yalnızca `http/https/mailto` izinli.
- **FR-ABT-02** Gövde boş/whitespace ise bölüm render edilmez.

### 2.9 Linkler (Şartname §9)

- **FR-LNK-01** Konum: Hakkımda'nın hemen altı, İletişim'in üstü. Başlık `Linkler`.
- **FR-LNK-02** Her kart tek `<a>` elemanıdır (kartın tamamı tıklanabilir): `[görsel][başlık]` yatay; `target="_blank" rel="noopener noreferrer"`; görsel `alt` = başlık.
- **FR-LNK-03** Yerleşim: Flexbox, `flex-wrap: wrap; justify-content: center; gap: var(--links-gap)`. Kart genişliği `flex: 0 0 calc((100% - (N-1)*gap)/N)`, N breakpoint'e göre: ≥1280 px → 6, ≥1024 → 4, ≥768 → 3, ≥480 → 2, <480 → 1. (Şartname §9.4 tablet 2–4, mobil 1–2 aralığına uyar.) Uygulama: N, tam genişlikteki bölümün **container query**'si ile seçilir (admin önizlemesindeki genişlik simülatörü aynı kuralı kullanır); eşikler kaydırma çubuğu payı için viewport eşiklerinin 16 px altındadır (1264 / 1008 / 752 / 464).
- **FR-LNK-04** Son satırdaki eksik kartlar `justify-content: center` ile ortalanır; sabit hesaplanan genişlik sayesinde satır kırılması deterministiktir.
- **FR-LNK-05** Hover: −2 px yükselme, kenarlık vurgu rengine geçiş, yumuşak gölge/parlama (200 ms). Reduced-motion'da yalnızca renk değişimi. Focus-visible halkası her temada görünür.
- **FR-LNK-06** Sıra `sortOrder ASC, id ASC`; pasif linkler API'den dönmez.

### 2.10 İndirme sayfaları (Şartname §10)

- **FR-DL-01** `/wallpapers`: başlık `Duvar kağıtlarını beğendin mi? Ücretsiz alabilirsin.`; masaüstü 3 sütun (≥1024), tablet 2, mobil 1.
- **FR-DL-02** `/pfps`: masaüstü 4 sütun (≥1024), tablet 3, mobil 2.
- **FR-DL-03** Sayfa açılışında sorumluluk uyarısı (`İndirdiğiniz içeriklerden sorumluluk kabul etmiyoruz.`) modal olarak gösterilir; "Anladım" ile kapanır; kabul `sessionStorage`'da sayfa bazlı tutulur. Uyarı kapanmadan grid render edilmez.
- **FR-DL-04** Sıra: `id ASC`. Sayfalama: sonsuz kaydırma, sayfa boyutu 24.
- **FR-DL-05** Kart: medya önizlemesi (sabit en-boy oranı: wallpaper 16:9, pfp 1:1, `object-fit: cover`), başlık, İndir butonu.
- **FR-DL-06** Önizleme: görsel → WebP önizleme varyantı; GIF → GIF (loop doğal); MP4 → `<video muted loop playsInline autoplay>` yalnızca kart görünür alandayken oynar (IntersectionObserver), değilse durur. Düşük efekt modunda video oynamaz, poster gösterilir; hover/focus ile oynar.
- **FR-DL-07** Medyaya tıklama → shadcn `Dialog` lightbox; büyük önizleme, ok tuşlarıyla önceki/sonraki, Escape kapatır. Video kontrollü (`controls`) ve loop.
- **FR-DL-08** İndir butonu `GET /api/public/downloads/:target/:publicId` adresine gider; yanıt `Content-Disposition: attachment; filename*=UTF-8''<güvenli-ad>.<uzantı>`. Dosya: wallpaper görselinde metadata'sı temizlenmiş `download` varyantı (PNG/JPEG/WebP), yoksa (GIF, MP4, pfp) ana dosya; MIME uzantıdan. `Cache-Control: no-store`. Sayaç tekilleştirmesi (FR-DSH-04) `pg_advisory_xact_lock(hedef:id:visitorHash)` altında yapılır; eşzamanlı iki istek sayacı iki kez artırmaz. "Aynı gün" = Europe/Istanbul günü. Liste uçları `Cache-Control: public, max-age=30`.
- **FR-DL-09** Liste boşsa: "Şu anda indirilebilir içerik yok." boş durumu + ana sayfaya dön butonu (HTTP 200, boş dizi).

### 2.11 İletişim (Şartname §18.2)

- **FR-CNT-01** Alanlar ve kurallar:

| Alan | Zorunlu | Kural |
|---|---|---|
| firstName | Evet | 1–60 karakter, trim |
| lastName | Evet | 1–60 karakter |
| phone | Hayır (2026-11-15) | Boş bırakılabilir → `null`. Doluysa E.164'e normalize edilebilir, 7–20 karakter, `+`, rakam, boşluk, `-`, `()` |
| email | Evet | RFC uyumlu, ≤ 254, küçük harfe çevrilir |
| subject | Evet | 3–120 karakter |
| message | Evet | 10–4000 karakter |
| turnstileToken | Evet | Sunucuda doğrulanır |
| website | — | Honeypot; doluysa sessizce 200 döner, kaydedilmez |

  Telefon: istemci yalnızca karakter/uzunluk kuralını (7–15 rakam) uygular; sunucu `libphonenumber-js` ile (varsayılan bölge `TR`) geçerliliği kontrol edip E.164'e çevirir (`0532 123 45 67` → `+905321234567`). Geçersizse alan bazlı 422 "Geçerli bir telefon numarası gir." Boşsa kaydedilmez (`null`); admin detayında telefon satırı ve `tel:` linki yalnızca numara varsa gösterilir, bildirim e-postasında "belirtilmedi" yazar. Ad/soyad/konu/mesajda kontrol karakterleri temizlenir.
- **FR-CNT-02** Rate limit: IP başına 3 mesaj / 10 dk, 10 mesaj / gün. Puan, şema geçen her denemede (CAPTCHA'dan önce) düşer; böylece CAPTCHA servisine giden istek de sınırlanır. Aşımda 429 + `Retry-After`.
- **FR-CNT-03** Başarıda form temizlenir ve "Mesajın ulaştı. En kısa sürede dönüş yapacağım." gösterilir (`aria-live="polite"`). Hata (429/503/ağ) formu temizlemez; açıklayıcı mesaj `role="alert"` ile gösterilir ve Turnstile widget'ı sıfırlanır.
- **FR-CNT-04** KVKK aydınlatma metni linki (`/kvkk`) form altında; gönderim öncesi açık onay kutusu zorunlu değildir (meşru menfaat/sözleşme öncesi), ancak aydınlatma linki ZORUNLU. `/kvkk` ve `/cerez-politikasi` sayfaları `GET /api/public/legal/:key` ile F14'te açılır (içerik düzenleme ekranı F16).
- **FR-CNT-05** Turnstile: site anahtarı `/api/public/site` → `captcha {provider:'turnstile', siteKey}`; widget betiği (`challenges.cloudflare.com`) yalnızca İletişim bölümü görünür olduğunda yüklenir. Sunucu `siteverify`'ı 5 sn zaman aşımıyla çağırır; başarısız token → 422 `turnstileToken` "Doğrulama başarısız oldu. Tekrar dene."; servis ulaşılamazsa 503 `CAPTCHA_UNAVAILABLE` (fail-closed). Prod'da anahtarlar zorunlu (env doğrulaması); dev/test'te Cloudflare'in her zaman geçen test anahtarları.
- **FR-CNT-06** Kayıt: `ipHash = HMAC-SHA256(dailySalt, ip)` (ham IP saklanmaz), `userAgent` ≤ 400, `retentionUntil = createdAt + 12 takvim ayı`. Bölüm her zaman görünür (CMS.md §2); ana sayfada en sonda, Linkler'in altında. Form bileşeni lazy chunk.

### 2.12 Tema ve görünüm (Şartname §14)

- **FR-THM-01** Tercihler `localStorage`: `theme` (`dark|light|system`), `surface` (`glass|classic`), `effects` (`full|low`).
- **FR-THM-02** `index.html` içinde, React'tan önce çalışan küçük inline script `<html>` üzerine `data-theme`, `data-surface`, `data-effects` atar (FOUC önleme). Bu script CSP'de hash ile izinlidir.
- **FR-THM-03** `system` iken `prefers-color-scheme` dinlenir.
- **FR-THM-04** Glass: `backdrop-filter: blur(16px) saturate(140%)` + yarı saydam yüzey. Yalnızca `@supports not (backdrop-filter)` durumunda opak yüzeye düşer. `effects` (animasyonlar) cam/klasik seçimini **etkilemez** (2026-11-16 kullanıcı kararı); ikisi bağımsız tercihlerdir.
- **FR-THM-06** (2026-11-16) Giriş animasyonları: her public bölüm ve kart görünür alana girince belirir (`features/motion/Reveal.jsx`: `Reveal` yukarı kayma + bulanıklık, `Stagger`/`StaggerItem` kart ızgaraları 70 ms arayla, `once`), sayfa geçişlerinde içerik yumuşakça gelir (public ve admin). Düşük efekt / reduced-motion'da yalnızca opaklık. Yüklenirken skeleton'lar korunur.
- **FR-THM-05** Tema geçişi `color`, `background-color`, `border-color` için 200 ms; reduced-motion'da 0.

### 2.13 Çerez yönetimi (Şartname §18.1)

- **FR-CKE-01** Kategoriler: `necessary` (her zaman açık: auth cookie'leri, CSRF, tercih localStorage'ı), `analytics` (varsayılan kapalı).
- **FR-CKE-02** Tercih `localStorage.consent = {version, analytics, decidedAt}` ve sunucuda anonim `CookieConsentRecord` (kanıt amaçlı, IP saklanmaz).
- **FR-CKE-03** Politika sürümü değişince banner tekrar gösterilir.
- **FR-CKE-04** Analitik olay gönderen kod, izin yoksa hiç çalışmaz (koşullu import).
- **FR-CKE-05** (F16 ayrıntıları) Banner: ekranın altında, **modal değil** (sayfa kullanılabilir, T-CNT-09); "Kabul et" / "Reddet" eşit ağırlıkta, "Tercihler" diyaloğu (analitik anahtarı + politika linki). Karar verilene kadar analitik kapalı. Footer'da her zaman "Çerez tercihleri" linki. `localStorage.consent` okunamazsa (gizli mod) her oturumda banner gösterilir, analitik kapalı kalır. Sunucu kaydı `POST /api/public/consent` (rate limit 20/saat/IP); yanıttaki `consentId` saklanır ve sonraki değişiklikler aynı kaydı günceller. Kayıt başarısız olsa da istemci tercihi geçerlidir.
- **FR-CKE-06** Analitik olayları: `PAGE_VIEW` her route değişiminde (yalnızca public sayfalar, `/admin` hariç), `PROJECT_VIEW` proje detayında. `visitorHash = HMAC(dailySalt, ip|ua)`; `PROJECT_VIEW` aynı ziyaretçi + proje + gün için bir kez yazılır ve yalnızca o zaman `Project.viewCount` +1 (FR-PRJ-03). Rate limit 120/dk/IP. İzin geri çekilince modül yeni olay göndermez.

---

## 3. Fonksiyonel gereksinimler — Admin

### 3.1 Kimlik doğrulama (Şartname §16)

- **FR-AUTH-01** Login: e-posta + şifre + `rememberMe`. Başarılıysa ve 2FA kapalıysa access token (yanıt gövdesi) + refresh cookie.
- **FR-AUTH-02** 2FA açıksa ilk adım `{ mfaRequired: true, mfaToken }` döner (5 dk ömürlü, tek amaçlı JWT). İkinci adım `POST /auth/2fa/verify { mfaToken, code | recoveryCode }`.
- **FR-AUTH-03** Access token: JWT HS256, 15 dk, claim'ler `sub, role, perms, sid, iat, exp, iss, aud`. Yalnızca bellekte (Zustand) tutulur; localStorage'a yazılmaz.
- **FR-AUTH-04** Refresh token: 256-bit rastgele, base64url; cookie `__Host-rt` (`HttpOnly; Secure; SameSite=Strict; Path=/`). DB'de SHA-256 hash'i saklanır. `rememberMe=true` → 7 gün kalıcı cookie; `false` → oturum cookie'si, sunucu tarafı mutlak ömür 12 saat.
- **FR-AUTH-05** Rotasyon: her `/auth/refresh` çağrısı eski oturum kaydını `rotatedAt` ile kapatır, aynı `familyId` ile yenisini açar. Döndürülmüş bir token tekrar gelirse (reuse) tüm aile iptal edilir ve audit `SESSION_REUSE_DETECTED` yazılır.
- **FR-AUTH-06** Logout: mevcut oturum `revokedAt` ile kapatılır, cookie silinir.
- **FR-AUTH-07** Hesap Ayarları > Oturumlar: aktif oturumlar listelenir (cihaz/UA, IP, son kullanım); tekil veya "diğer tüm oturumları sonlandır".
- **FR-AUTH-08** Şifre politikası: en az 12 karakter, en fazla 128; zxcvbn skor ≥ 3 GEREKLİ; e-posta ile aynı olamaz. Şifre değişince diğer tüm oturumlar iptal edilir.
- **FR-AUTH-09** `mustChangePassword = true` olan admin yalnızca `/auth/me`, `/account/password`, `/auth/logout` endpoint'lerini kullanabilir; frontend `/admin/change-password`'a yönlendirir.
- **FR-AUTH-10** Şifremi unuttum: `POST /auth/forgot-password { email }` her durumda aynı 202 yanıtını ve benzer sürede döner. SMTP yapılandırılmamışsa e-posta gönderilmez (audit'e `PASSWORD_RESET_SMTP_MISSING`). Token 32 byte, SHA-256 hash'li, 30 dk, tek kullanımlık; yeni token önceki aktif tokenları geçersiz kılar.
- **FR-AUTH-11** Reset: `POST /auth/reset-password { token, newPassword }`; başarıda tüm oturumlar iptal.
- **FR-AUTH-12** 2FA kurulum: `POST /account/2fa/setup` (secret üret, şifreli geçici sakla, otpauth URI + QR data URL döndür) → `POST /account/2fa/enable { code }` → 10 kurtarma kodu bir kez gösterilir. Kapatma: mevcut şifre + geçerli TOTP/kurtarma kodu.
- **FR-AUTH-13** TOTP: 30 sn adım, 6 hane, ±1 pencere; aynı kod aynı adımda ikinci kez kabul edilmez (`lastTotpStep` saklanır).

### 3.2 İlk kurulum (Şartname §16.2)

- **FR-SETUP-01** `npm run admin:create -w backend` CLI: e-posta ve şifreyi `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` ortam değişkenlerinden veya etkileşimli gizli girişten alır; hiçbir değer dosyaya yazılmaz.
- **FR-SETUP-02** Oluşturulan hesap `role = SUPER_ADMIN`, `mustChangePassword = true`.
- **FR-SETUP-03** Zaten SUPER_ADMIN varsa CLI çıkış kodu 1 ile durur; `--force` yalnızca yeni ek süper admin ekler, mevcut hesabı değiştirmez.
- **FR-SETUP-04** HTTP üzerinden kurulum endpoint'i **yoktur**.

### 3.3 Admin modülleri

Menü sırası ve ekran detayları ADMIN.md §3; içerik kuralları CMS.md. Ortak kurallar:

- **FR-ADM-01** Tüm liste ekranları: arama (`q`), filtre, sıralama, sayfalama (`page`, `pageSize` ≤ 100), skeleton.
- **FR-ADM-02** Tüm formlar: Zod ile istemci + sunucu validasyonu (aynı şema), alan altı hata mesajları, kaydetme durumu (buton spinner + disabled), başarı/hata toast'ı (shadcn `Sonner`).
- **FR-ADM-03** Kaydedilmemiş değişiklik varken sayfadan ayrılma uyarısı.
- **FR-ADM-04** Yıkıcı işlemler (`Sil`, `Oturumu sonlandır`) `AlertDialog` onayı ister; silinecek kaydın adı gösterilir.
- **FR-ADM-05** Sıralama değeri değişiklikleri sürükle-bırak (`@dnd-kit`) ile yapılır, `PATCH .../reorder { ids: [] }` toplu gönderilir; klavye ile sıralama desteklenir.
- **FR-ADM-06** Her yazma işlemi audit log üretir (bkz. §6).

### 3.4 Medya hattı (Şartname §11)

- **FR-MED-01** Yükleme `multipart/form-data`, alan adı `file`. Önce geçici dizine stream edilir (`uploads/tmp`), limit aşımında stream kesilir (413).
- **FR-MED-02** Doğrulama sırası: (1) boyut limiti, (2) uzantı izin listesi, (3) `file-type` ile magic bytes → gerçek MIME, (4) uzantı–MIME eşleşmesi, (5) türe özel kontrol (görsel boyutları, video süresi/codec, cursor ölçüsü). Herhangi biri başarısız → geçici dosya silinir.
- **FR-MED-03** İzinli türler ve limitler:

| Kullanım (MediaKind) | Uzantılar | Gerçek MIME | Maks. boyut | Ek kural |
|---|---|---|---|---|
| BACKGROUND | mp4, gif, jpg, jpeg, png | video/mp4, image/gif, image/jpeg, image/png | video 200 MB, görsel 20 MB | video ≤ 120 sn |
| MUSIC_AUDIO | mp3 | audio/mpeg | 30 MB | ≤ 15 dk |
| MUSIC_COVER | gif, png, jpg, jpeg | image/* (aynı) | 10 MB | |
| PROFILE | mp4, gif, jpg, jpeg, png | aynı | video 50 MB, görsel 15 MB | video ≤ 30 sn |
| CURSOR | png, cur, ico | image/png, image/x-icon, image/vnd.microsoft.icon | 512 KB | ≤ 128×128 px, önerilen 32×32 |
| PROJECT_IMAGE | jpg, jpeg, png, webp, gif | image/* | 15 MB | |
| LINK_IMAGE | jpg, jpeg, png, webp, gif, svg yok | image/* | 5 MB | SVG kabul edilmez (XSS) |
| FAVICON | ico, png | image/x-icon, image/png | 1 MB | ≤ 512×512 |

- **FR-MED-04** Statik görsel işleme (Sharp): `rotate()` (EXIF yönü uygulanır) → metadata atılır → orijinal yerine WebP ana varyant (kalite 82, maks. uzun kenar 2560; BACKGROUND görselinde ayrıca metadata'sız indirme varyantı) + thumbnail (uzun kenar 480, kalite 70). Orijinal dosya politikası: **orijinal saklanmaz** (EXIF temizliği garanti); wallpaper istisnadır: indirme için EXIF'i temizlenmiş, yeniden kodlanmamış orijinal (JPEG/PNG) `metadata` silinerek saklanır ki indirme kalitesi kaybolmasın. Uygulama notu (F6): JPEG'de APP1–APP15 + COM segmentleri, PNG'de metin/eXIf/tIME chunk'ları baytlar yeniden kodlanmadan atılır (`media/formats.js`); EXIF yönü 1 dışındaki JPEG ve WEBP wallpaper'lar yönü korumak için döndürülüp kalite 95 ile yeniden kodlanır. Video wallpaper'da ayrı indirme varyantı yoktur (`downloadKey ?? storageKey`).
- **FR-MED-05** GIF: hareketli ise korunur (yeniden kodlanmaz, metadata uzantıları temizlenir); thumbnail ilk kareden WebP. `isAnimated = true`.
- **FR-MED-06** Video (FFmpeg): H.264 (`libx264`, CRF 23, `preset medium`, `yuv420p`, `+faststart`), maks. 1920 px genişlik , ses kaldırılır (BACKGROUND, PROFILE önizleme), poster = 1. saniyeden WebP, thumbnail 480 px. İş kuyruğunda çalışır; `processingStatus` PENDING → PROCESSING → READY/FAILED. Eşzamanlı en fazla 1 FFmpeg işi, işlem başına zaman aşımı 10 dk.
- **FR-MED-06b** (2026-11-16) Arka plan videoları: ana kopya 4K'ya kadar (3840 px, CRF 20, ≤ 16 Mbps) — indirme ve > 2400 px ekranlar; ayrıca kaynaktan küçükse 1080p (CRF 23, ≤ 5 Mbps) ve 720p (CRF 24, ≤ 3 Mbps) oynatma kopyaları (`metadata.variants`, `/media/:id/v1080|v720`). Hepsi H.264 + faststart, ≤ 30 fps (her tarayıcı/cihaz). Public `today.background.sources` küçükten büyüğe; tarayıcı `<source media>` ile ekrana uygun olanı seçer (≤ 900 px: 720p, ≤ 2400 px: 1080p). Video telefonda da oynar; yalnızca veri tasarrufu / 2G-3G'de poster. Önce poster görünür.
- **FR-MED-07** MP3: `music-metadata` ile süre okunur (≤ 15 dk); ID3v2 (tekrarlı), ID3v1 ve APEv2 etiketleri (gömülü kapak dahil) ses karelerine dokunmadan JS ile kesilir (`media/formats.js` `stripMp3Tags`). FFmpeg gerekmez; senkron işlenir, kayıt doğrudan READY olur.
- **FR-MED-08** Cursor: PNG ise boyut doğrulanır, yeniden kodlanmaz; ICO/CUR olduğu gibi saklanır. Hotspot koordinatları admin tarafından girilir (varsayılan 0,0), görsel sınırları içinde olmalı.
- **FR-MED-09** Depolama anahtarı: `<kind-dizini>/<uuid-v4>.<uzantı>`; kullanıcı dosya adı yalnızca `originalFilename` alanında (gösterim) ve `safeFilename` (indirme adı: slugify, ≤ 80 karakter) olarak tutulur.
- **FR-MED-10** SHA-256 hash hesaplanır; aynı türde aynı hash varsa admin'e "Bu dosya zaten yüklü: <başlık>" uyarısı verilir (engellenmez).
- **FR-MED-11** Silme: önce kullanım kontrolü (bkz. DATABASE.md §5 "Kullanımdaki medya"); kullanılıyorsa 409 + kullanan kayıtların listesi. Değilse transaction içinde DB kaydı silinir ve tüm varyant anahtarları `StorageDeletionJob` tablosuna yazılır; commit sonrası worker fiziksel dosyaları siler, başarısızlıkta 5 kez artan bekleme ile yeniden dener.
- **FR-MED-12** Geçici dizindeki 24 saatten eski dosyalar saatlik temizlenir. Video kuyruk kaynakları (`tmp/queue/<assetId>.mp4`) yalnızca bekleyen (PENDING/PROCESSING) işi yoksa silinir.
- **FR-MED-13** FFmpeg/ffprobe sunucuda yoksa video yüklemesi açık hata ile reddedilir: `503 MEDIA_PROCESSOR_UNAVAILABLE` (sessizce kuyruğa alınmaz). Kuyrukta FFmpeg bulunamazsa kayıt `FAILED` + `processingError` + `MEDIA_PROCESSING_FAILED` audit. Video süre limiti yükleme anında ffprobe ile kontrol edilir (aşım 422).

### 3.5 Günlük rotasyon (Şartname §13)

- **FR-ROT-01** Kategoriler: BACKGROUND, MUSIC, PFP, CURSOR; birbirinden bağımsız.
- **FR-ROT-02** Uygun havuz (eligible pool): `isActive = true AND rotationEnabled = true` (ve medya `processingStatus = READY`). MUSIC için ses ve kapak READY olmalı.
- **FR-ROT-03** Algoritma `selectForDate(category, date)`:
  1. Transaction başlat; `pg_advisory_xact_lock(hashtext('rotation:' || category))`.
  2. `(category, date)` için kayıt varsa ve içeriği hâlâ uygunsa onu döndür (**idempotent**).
  3. `currentCycle = MAX(cycleNumber)` (yoksa 1).
  4. `used = currentCycle içindeki seçilmiş contentId'ler`.
  5. `candidates = pool − used`. Boşsa: `currentCycle += 1`, `candidates = pool`; havuz > 1 ise bir önceki günün seçimi aday dışı (döngü sınırında arka arkaya tekrar engellenir).
  6. `candidates` boşsa (havuz boş): kayıt yazılmaz, `null` döner.
  7. `crypto.randomInt` ile bir aday seçilir; `(category, date)` için upsert yazılır.
- **FR-ROT-04** Cron: `0 0 * * *`, `timezone: 'Europe/Istanbul'`. Ayrıca uygulama açılışında ve public `GET /api/public/site` çağrısında bugünün kaydı yoksa `ensureToday()` çalışır (kaçırılan cron telafisi). Hepsi aynı idempotent fonksiyonu kullanır.
- **FR-ROT-05** Bugünün seçimi silinir/pasife alınırsa: ilgili servis aynı transaction'da `reselectToday(category)` çağırır — mevcut kayıt güncellenir (aynı döngü, kalan adaylardan).
- **FR-ROT-06** Yeni eklenen aktif içerik, mevcut döngüde "kullanılmamış" sayıldığı için kendiliğinden aday havuzuna girer.
- **FR-ROT-07** Override (Şartname §13.4): `ContentOverride` kaydı `validUntil = bir sonraki 00:00 Europe/Istanbul`. Çözümleme sırası: geçerli override → bugünkü otomatik seçim → `null` (fallback). Cron her gece süresi dolan override'ları siler. Override döngü geçmişini etkilemez.
- **FR-ROT-08** "Şimdi yeniden seç" (Sistem Ayarları): bugünkü otomatik seçimi aynı döngüden kalan adaylarla değiştirir; audit'e yazılır.
- **FR-ROT-09** Tarih hesabı: `selectedDate`, `Europe/Istanbul` takvim günü olarak `DATE` tipinde saklanır; sunucu saat dilimine bağımlı olunmaz.

### 3.6 Fallback'ler (rotasyon boş olduğunda)

| Kategori | Fallback |
|---|---|
| BACKGROUND | Tema token'larından türetilen statik gradyan sahne (`--scene-fallback`) |
| MUSIC | Oynatıcı render edilmez |
| PFP | `HeroSettings.profileMode=FIXED` görseli, yoksa baş harf avatarı |
| CURSOR | Sistem imleci |

---

## 4. Entegrasyonlar (Şartname §5)

### 4.1 Ortak

- **FR-INT-01** Her sağlayıcı `IntegrationSetting` satırıdır; `isEnabled = false` ise public endpoint `{ enabled: false }` döner ve kart render edilmez.
- **FR-INT-02** Veri, backend worker tarafından çekilir ve `publicSnapshot` (yalnızca public alanlar) olarak saklanır; public endpoint yalnızca snapshot'ı okur. Ziyaretçi isteği **hiçbir zaman** dış API'ye doğrudan çağrı tetiklemez.
- **FR-INT-03** Dış çağrılar 5 sn zaman aşımı; 429'da `Retry-After`'a uyulur; ardışık 3 hatada üstel bekleme (maks. 15 dk).
- **FR-INT-04** Snapshot yaşı `staleAfter` değerini aşarsa public yanıtta `stale: true` döner; frontend "son güncelleme X dk önce" gösterebilir.
- **FR-INT-05** Secret'lar (`secretsEnc`) AES-256-GCM ile şifrelenir; admin API yanıtında yalnızca `{ botToken: { isSet: true } }` biçiminde döner.
- **FR-INT-06** Admin "Bağlantıyı test et" butonu: senkron test çağrısı, sonucu ve hata mesajını (secret içermeyen) döndürür, `lastError` günceller.
- **FR-INT-07** (F15 ayrıntıları) `staleAfter`: Discord 10 dk, Spotify 3 dk, GitHub 2 sa. Snapshot yoksa public yanıt `{enabled:true, stale:true, data:null}` ve kart "Şu an alınamıyor" durumunu gösterir (sayfa çalışmaya devam eder). Durum alanı: başarılı sync → `CONNECTED`, hata → `ERROR` + `lastError` (≤ 500 karakter, secret ve token içermez), kapalı/yapılandırılmamış → `DISCONNECTED`. Backoff sağlayıcı başına bellekte tutulur: 3 ardışık hatadan sonra bekleme 1 → 2 → 4 … ≤ 15 dk; 429'da `Retry-After` (≤ 15 dk) uygulanır; başarıda sıfırlanır. Ayar değişikliği (aç/kapa, config, secret) o sağlayıcının işçisini yeniden başlatır.
- **FR-INT-08** Public kartlar ana sayfada Hero'nun altında bento ızgara (masaüstü 3 sütun, tablet 2, mobil 1); her kart kendi ucunu 30 sn (Spotify) / 60 sn (diğerleri) aralıkla yeniler. Uç hatasında kart kontrollü hata durumunda kalır (T-PUB-10). Kapalı sağlayıcı (`site.integrations.x=false`) kartı ve isteği yoktur. Hero profil halkasında Discord durum noktası **gösterilmez** (2026-11-16 kullanıcı kararı); durum yalnızca Discord kartında.

### 4.2 Discord — FR-INT-D

- Bot `discord.js` ile Gateway'e bağlanır; intents: `Guilds`, `GuildMembers`, `GuildPresences`, `GuildVoiceStates` (ilk ikisi ayrıcalıklı — Developer Portal'da açılmalı).
- Hedef kullanıcı, botun bulunduğu en az bir sunucunun üyesi olmalıdır; değilse durum "Kullanıcı botla ortak sunucuda değil" hatasıdır.
- Snapshot alanları (2026-11-16 genişletildi — profil kartı): `avatarUrl`, `avatarDecorationUrl`, `bannerUrl` + `accentColor` (kullanıcı zorla çekilir), `username`, `globalName`, `status`, `customStatus {text, emoji{name,url}}`, `activities[]` (oyun, **Spotify dahil müzik**, yayın, izleme, yarışma: `name, details, state, startedAt, endsAt, largeImageUrl, smallImageUrl, url`), `voice {channelName, guildName, muted, deafened}` (ses kanalındaysa), `badges[]` (public flags → Türkçe etiket), `serverTag {tag, badgeUrl}`, `nameplate {url,label}`. **Bot API'sinde olmayanlar uydurulmaz:** hitap şekli admin Durumlar ekranında elle girilir (`config.pronouns` ≤ 40; public okumada snapshot'a eklenir); biyografi gösterilmez (2026-11-16 kaldırıldı); özel durum etkinlik değil, avatardan çıkan düşünce baloncuğudur; profil efekti, isim efekti/yazı stili ve Nitro rozetleri **gösterilemez** (yalnızca kullanıcı hesabı API'sinde var; kullanıcı token'ı kullanmak Discord kurallarına aykırı). Biyografide Discord özel emoji sözdizimi `<:ad:id>` CDN görseline çevrilir. Tüm dış URL'ler yalnızca `https:`.
- Presence, kullanıcı ve ses durumu değişiminde snapshot güncellenir (debounce 2 sn); ayrıca 5 dk'da bir tam yenileme. Hero'da Discord durum noktası yok; durum yalnızca kartta.
- **CDN boyutları** (2026-11-16 hata düzeltmesi): discord.js görsel URL'lerinde boyut yalnızca 2'nin kuvveti olabilir (16…4096); geçersiz boyut `RangeError` fırlatıp tüm senkronu düşürüyordu (banner 600 → 1024, etkinlik görseli 160 → 256). Her URL ayrı korunur; tek alan hatası snapshot'ı düşürmez. Kod içi hatalar admin'e "Discord verisi işlenemedi" olarak, ayrıntısı sunucu loguna yazılır.
- **Banner** yalnızca Discord'dan gelir (elle yükleme 2026-11-16'da kaldırıldı). Kartta Discord'un açılır profil oranında (17:6, 680×240) gösterilir; genişliğe göre ölçeklenir.
- **Bot API sınırları:** Profil efekti, hitap şekli (zamirler), Nitro/takviye/görev gibi rozetler bot API'sinde yok; yalnızca herkese açık bayrak rozetleri (HypeSquad, Aktif Geliştirici, Erken Destekçi vb.) alınır. Hitap şekli admin'den elle girilir.
- **FR-INT-09 Canlı durum** (2026-11-16): `GET /api/public/status/:provider/stream` (SSE). Snapshot yazıldığında ve ayar değiştiğinde açık sayfalara anında gönderilir; durum kartları (Discord, Spotify) sayfa yenilemeden güncellenir. Tarayıcı kendisi yeniden bağlanır; yoklama yedek olarak sürer. Tek yönlü akış için WebSocket yerine SSE seçildi (aynı origin, ek kütüphane yok). Spotify'ın anlık bildirimi olmadığından işçi çalarken 10 sn'de bir, parça bitmek üzereyse bitişin hemen ardından, çalmıyorken 60 sn'de bir sorgular (`nextIntervalMs`); her yeni snapshot SSE ile anında iletilir, ilerleme çubuğu arada yerelde akar.
- Avatar/dekorasyon görselleri Discord CDN'den doğrudan yüklenir (`cdn.discordapp.com` CSP `img-src` izinli).

### 4.3 Spotify — FR-INT-S

- OAuth2 Authorization Code akışı (sunucu tarafı, `state` CSRF parametresiyle). Scope: `user-read-currently-playing user-read-playback-state user-top-read user-read-private`.
- Redirect URI: `${PUBLIC_ORIGIN}/api/admin/integrations/spotify/callback`. Callback, `state`'i imzalı kısa ömürlü cookie ile eşleştirir. Not: Spotify artık `http://localhost` redirect'ini kabul etmez; geliştirmede `PUBLIC_ORIGIN=http://127.0.0.1:5173` ile açılmalı (prod'da HTTPS alan adı).
- Refresh token `secretsEnc` içinde şifreli saklanır; access token bellekte.
- Polling: şu an çalan 60 sn; top 3 parça (`time_range=short_term`) 6 saatte bir; profil 24 saatte bir. Ziyaretçi sayısından bağımsızdır.
- Snapshot: `profile {displayName, avatarUrl}`, `nowPlaying {isPlaying, title, artists[], albumArtUrl, trackUrl, progressMs, durationMs, fetchedAt}` veya `null`, `topTracks[]` (≤ 3).
- Frontend ilerleme çubuğunu `fetchedAt + progressMs` ile yerel olarak ilerletir; 30 sn'de bir snapshot yeniden çekilir.
- Top tracks erişimi reddedilirse alt bölüm gizlenir.

### 4.4 GitHub — FR-INT-G

- Config: `username`. Opsiyonel `GITHUB_TOKEN` (env) rate limit için.
- Snapshot: `avatarUrl`, `login`, `name`, `htmlUrl`, `publicRepos`, `followers`; 1 saatte bir.
- İstatistik kartları (Readme Stats, Streak Stats): `?theme=dark|light` (yalnızca bu iki değer; varsayılan dark) public temaya uyar. Backend, sabit host listesindeki servislerden SVG'yi çeker, **SVG'yi sanitize etmeden** `<img>` olarak sunmak için `Content-Type: image/svg+xml` + `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` header'larıyla `/api/public/status/github/cards/:card.svg` üzerinden proxy eder; 6 saat cache. `<img>` içindeki SVG script çalıştıramaz. Servis hatasında aynı ölçüde nötr bir placeholder SVG döner (layout bozulmaz).
- Host listesi env'den (`GITHUB_STATS_BASE_URL`, `GITHUB_STREAK_BASE_URL`) gelir; kullanıcı girdisiyle URL oluşturulmaz (SSRF önlemi), yalnızca `username` encode edilerek query'ye eklenir.

---

## 5. İletişim mesajları (Şartname §15.10)

- **FR-MSG-01** Liste: okunmamış önce, tarih DESC; filtre: okundu/okunmadı, bekliyor/yanıtlandı, spam.
- **FR-MSG-02** Detay açılınca `isRead = true`, `readAt` set.
- **FR-MSG-03** Durum geçişleri: `PENDING ↔ REPLIED`; `isSpam` bağımsız bayrak. Spam işaretli mesajlar varsayılan listede gizlidir.
- **FR-MSG-04** "E-posta ile yanıtla" → `mailto:` (şablonlu konu ve gövde, `CONTACT_REPLY_EMAIL`). WhatsApp / telefonla yanıt yoktur (CMS.md §6).
- **FR-MSG-05** Saklama: `retentionUntil = createdAt + 12 ay`; günlük temizlik işi süresi dolanları kalıcı siler. Admin manuel silebilir.
- **FR-MSG-06** Opsiyonel bildirim: `MailSettings.notifyOnContact` açıksa şablonla e-posta (mesaj gövdesi HTML-escape edilerek). Gönderim yanıttan sonra arka planda; hata ziyaretçi yanıtını etkilemez ve mesaj içeriği loglanmaz. Alıcı `notifyEmail`, yoksa `fromEmail`; `Reply-To` gönderen. Ayar: Hesap Ayarları > E-posta (`PUT /api/admin/account/mail`).
- **FR-MSG-07** Gelen kutusu görünümleri: `Gelen` (spam hariç), `Okunmamış`, `Bekliyor`, `Yanıtlandı`, `Spam`; arama ad/soyad/e-posta/konu. Sidebar'da okunmamış rozeti (60 sn'de bir yenilenir, 99+ üst sınır). Klavye: `j`/`k` sonraki/önceki, `e` yanıtlandı ↔ bekliyor, `s` spam aç/kapa (input odaktayken devre dışı). Mobilde liste → detay tek sütun, geri butonu.

---

## 6. Audit log (Şartname §17.1)

- **FR-AUD-01** Kaydedilen olaylar (`action` sabitleri, RULES.md §6'da tam liste): `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`, `AUTH_2FA_FAILED`, `SESSION_REVOKED`, `SESSION_REUSE_DETECTED`, `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `EMAIL_CHANGED`, `2FA_ENABLED`, `2FA_DISABLED`, `<ENTITY>_CREATED|UPDATED|DELETED`, `MEDIA_UPLOADED`, `MEDIA_DELETED`, `SETTINGS_UPDATED`, `INTEGRATION_UPDATED`, `ROTATION_OVERRIDE_SET|CLEARED`, `ROTATION_RESELECTED`.
- **FR-AUD-02** Kayıt: `adminId`, `action`, `entityType`, `entityId`, `metadata` (değişen alan adları; değerler yalnızca allowlist'teki güvenli alanlar için), `ipAddress`, `userAgent`, `createdAt`.
- **FR-AUD-03** Metadata, yazılmadan önce redaction fonksiyonundan geçer: anahtar adı `/pass|secret|token|key|code|hash/i` ile eşleşen her alan `"[REDACTED]"` olur.
- **FR-AUD-04** Audit kayıtları yalnızca okunur; API'de güncelleme/silme endpoint'i yoktur. Saklama 24 ay (otomatik temizlik).
- **FR-AUD-05** Ekran: tarih aralığı, admin, eylem, varlık türü filtreleri; CSV dışa aktarma (SUPER_ADMIN).

---

## 7. Dashboard ve analitik (Şartname §15.3)

- **FR-DSH-01** Göstergeler: toplam / günlük / haftalık / aylık ziyaretçi (analitik izni veren ziyaretçiler; açıkça "izinli ziyaretçiler" etiketiyle), en çok indirilen 5 wallpaper ve 5 pfp, en çok görüntülenen 5 proje, son 10 admin işlemi, entegrasyon durumları, depolama kullanımı (tür bazında toplam byte).
- **FR-DSH-02** Ziyaretçi kimliği: `visitorHash = HMAC-SHA256(dailySalt, ip + '|' + userAgent)`; `dailySalt` her gün yeniden üretilir ve önceki gün tuzu silinir → günler arası izlenemez. Ham IP saklanmaz.
- **FR-DSH-03** "Ziyaretçi" = gün içindeki benzersiz `visitorHash` sayısı; haftalık/aylık = günlük benzersizlerin toplamı (yaklaşık; etiketle belirtilir).
- **FR-DSH-04** İndirme sayacı (Şartname §10.4): her indirme isteği `DownloadEvent` üretir; aynı `visitorHash` + içerik için aynı gün ikinci istek `counted = false`. Ayrıca IP başına 30 indirme / 10 dk limit (429). Sayaç izinden bağımsızdır (hizmetin zorunlu parçası, ham kişisel veri saklanmaz). `DownloadEvent.visitorHash` 90 gün sonra `NULL`'lanır.

---

## 8. Fonksiyonel olmayan gereksinimler

### 8.1 Performans — NFR-PERF

- **NFR-PERF-01** Public route'lar kod bölünür; admin paketi `React.lazy` ile ayrı chunk, public bundle'a dahil edilmez.
- **NFR-PERF-02** Görseller `loading="lazy"`, `decoding="async"`, `width/height` veya `aspect-ratio` ile; `srcset` (thumbnail + ana varyant).
- **NFR-PERF-03** Arka plan videosu: mobilde (`max-width: 767px` veya `navigator.connection.saveData` veya `effectiveType` 2g/3g) poster gösterilir, video yüklenmez.
- **NFR-PERF-04** `GET /api/public/site` tek çağrıda sayfa iskeleti için gereken her şeyi döndürür (ayarlar, hero, günlük seçimler, nav bayrakları, footer); sunucu tarafı 30 sn bellek cache'i, ilgili admin yazımında invalidation.
- **NFR-PERF-05** Medya yanıtları: `Cache-Control: public, max-age=31536000, immutable` (anahtarlar içerik değişince değişir), `ETag`, HTTP Range desteği (video/ses seek için ZORUNLU).
- **NFR-PERF-06** gzip/brotli reverse proxy'de; API JSON yanıtları sıkıştırılır.
- **NFR-PERF-07** Animasyonlar yalnızca `transform` ve `opacity` üzerinde; layout tetikleyen özellik animasyonu yasak.

### 8.2 Erişilebilirlik — NFR-A11Y (WCAG 2.2 AA)

- **NFR-A11Y-01** Tüm etkileşimler klavye ile yapılabilir; mantıklı odak sırası; `:focus-visible` halkası kontrast ≥ 3:1.
- **NFR-A11Y-02** Metin kontrastı ≥ 4.5:1 (büyük metin 3:1) — arka plan medyası üstündeki metin dahil (scrim ile garanti edilir; test: en parlak örnek arka planla).
- **NFR-A11Y-03** Form alanlarında `<label>`, hata mesajı `aria-describedby`, hata durumunda `aria-invalid`.
- **NFR-A11Y-04** Dinamik bildirimler (toast, form sonucu) `aria-live="polite"`.
- **NFR-A11Y-05** Dokunma hedefleri ≥ 44×44 px (WCAG 2.5.8 için min. 24×24, hedef 44).
- **NFR-A11Y-06** Hareket: `prefers-reduced-motion` ve düşük efekt modu; otomatik oynayan videolar (5 sn'den uzun) için durdurma yolu: düşük efekt anahtarı + lightbox kontrolleri.
- **NFR-A11Y-07** `lang="tr"`; Welcome metni `lang="en"` span'i içinde.

### 8.3 Responsive — NFR-RESP

- Breakpoint'ler (Tailwind varsayılanı + ek): `xs 480`, `sm 640`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`. 320 px'te yatay scroll yok. İçerik maks. genişliği 1200 px (Linkler bölümü 1280 px).

### 8.4 Güvenilirlik — NFR-REL

- **NFR-REL-01** Dış servis hatası public sayfayı çökertmez (snapshot mimarisi + Error Boundary).
- **NFR-REL-02** Graceful shutdown: SIGTERM'de yeni istek kabul edilmez, aktif istekler 10 sn içinde tamamlanır, Prisma ve Discord bağlantıları kapatılır, FFmpeg işi iptal edilip PENDING'e alınır.
- **NFR-REL-03** `GET /api/health` (liveness) ve `GET /api/ready` (DB ping) endpoint'leri.

### 8.5 Bakım — NFR-MAINT

- ESLint + Prettier CI'da zorunlu; backend servis katmanı için birim testleri (Vitest), API için entegrasyon testleri (Supertest + test DB), kritik akışlar için E2E (Playwright).
- Kapsam hedefi: servis katmanı ≥ %80; rotasyon, auth, URL doğrulama, medya doğrulama %100 dal kapsamı.

### 8.6 Gözlemlenebilirlik — NFR-OBS

- Her isteğe `X-Request-Id` (gelen varsa doğrulanır, yoksa UUID); loglarda ve hata yanıtında yer alır.
- `pino` redaction yolları: `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.token`, `*.secret`, `*.botToken`, `*.clientSecret`, `*.appPassword`, `*.code`.

---

## 9. Güvenlik gereksinimleri — SEC

| ID | Gereksinim | Uygulama yeri |
|---|---|---|
| SEC-01 | Argon2id (`memoryCost 19456 KiB, timeCost 2, parallelism 1` — OWASP asgarisi; sunucu kapasitesine göre artırılabilir) | `auth/password.js` |
| SEC-02 | Tüm DB erişimi Prisma; raw SQL yalnızca `$queryRaw` tagged template | RULES.md §4 |
| SEC-03 | Tüm girdiler Zod ile doğrulanır; bilinmeyen alanlar reddedilir (`.strict()`) | `middleware/validate.js` |
| SEC-04 | XSS: React escaping; `dangerouslySetInnerHTML` yasak; Markdown raw HTML kapalı + sanitize; CSP | RULES.md §5 |
| SEC-05 | CSRF: access token header'da (CSRF'e kapalı); cookie kullanan `/auth/refresh` ve `/auth/logout` için `SameSite=Strict` + double-submit `X-CSRF-Token` + Origin kontrolü | ARCHITECTURE.md §4 |
| SEC-06 | Helmet + CSP (aşağıda) + HSTS (prod, 1 yıl, includeSubDomains) | `app.js` |
| SEC-07 | CORS: yalnızca `CORS_ORIGINS` listesi; aynı origin prod'da CORS kapalı | `app.js` |
| SEC-08 | Rate limit: login (IP 10/15 dk, hesap 5/15 dk), forgot-password (IP 3/saat, e-posta 3/saat), 2FA verify (5/15 dk/mfaToken), contact (FR-CNT-02), download (FR-DSH-04), genel public API (IP 300/dk), admin API (oturum 600/dk) | `middleware/rateLimit.js` |
| SEC-09 | Admin route'larında `requireAuth` + `requirePermission`; frontend gizleme tek başına yeterli sayılmaz | ROUTES.md |
| SEC-10 | Upload: boyut, uzantı, MIME, magic bytes, yeniden kodlama; SVG yasak | FR-MED-02 |
| SEC-11 | Path traversal: dosya yolu yalnızca DB'deki `storageKey`'den; `path.resolve` sonucu depo kökü dışındaysa 400 | `storage/local.js` |
| SEC-12 | URL alanları: `new URL()` ile parse, protokol ∈ {`http:`, `https:`}, kullanıcı bilgisi (`user:pass@`) yasak, ≤ 2048 karakter | `packages/shared/validation/url.js` |
| SEC-13 | Secret'lar loglanmaz, public yanıtlara girmez; şifreli alanlar API'de `isSet` olarak döner | FR-INT-05 |
| SEC-14 | Prod'da HTTPS zorunlu; HTTP → HTTPS yönlendirme proxy'de; `__Host-` cookie öneki | Deploy |
| SEC-15 | Hata yanıtları stack trace içermez; prod'da 500 mesajı genel | `middleware/errorHandler.js` |
| SEC-16 | `npm audit` + Dependabot/Renovate; CI'da yüksek/kritik açık build'i kırar | CI |
| SEC-17 | Uygulama şifreleme anahtarı `APP_ENCRYPTION_KEY` (32 byte, base64); anahtar rotasyonu için `keyVersion` öneki (`v1:`) | `lib/crypto.js` |
| SEC-18 | Hesap numaralandırma: login, forgot-password yanıtları hesabın varlığını açık etmez; login'de bilinmeyen e-posta için de sahte Argon2 doğrulaması yapılır (zamanlama eşitleme) | `auth/service.js` |
| SEC-19 | Admin yanıtlarına `Cache-Control: no-store` | `middleware/noStore.js` |
| SEC-20 | Medya sunumunda `X-Content-Type-Options: nosniff`; indirmelerde `Content-Disposition: attachment` | `media/serve.js` |

### 9.1 Content-Security-Policy (prod)

```
default-src 'self';
script-src 'self' 'sha256-<tema-init-script-hash>' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://cdn.discordapp.com https://media.discordapp.net https://i.scdn.co https://*.spotifycdn.com https://avatars.githubusercontent.com;
media-src 'self' blob:;
font-src 'self';
connect-src 'self';
frame-src https://challenges.cloudflare.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

`style-src 'unsafe-inline'` Framer Motion'ın inline style kullanımı nedeniyle gereklidir; script tarafında inline izin yoktur.

---

## 10. Hata yanıtı standardı

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Gönderilen veriler geçersiz.",
    "details": [{ "path": "url", "message": "Yalnızca http ve https adresleri kabul edilir." }],
    "requestId": "8b1f..."
  }
}
```

| HTTP | code | Kullanım |
|---|---|---|
| 400 | `BAD_REQUEST` | Biçimsiz istek |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` | Kimlik yok / access token süresi doldu (istemci refresh dener) |
| 403 | `FORBIDDEN` / `PASSWORD_CHANGE_REQUIRED` / `CSRF_FAILED` | Yetki yok |
| 404 | `NOT_FOUND` | Tekil kayıt yok |
| 409 | `CONFLICT` / `IN_USE` | Benzersizlik ihlali / kullanımdaki kayıt |
| 413 | `PAYLOAD_TOO_LARGE` | Dosya limiti |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Dosya türü |
| 422 | `VALIDATION_ERROR` | Alan doğrulaması |
| 423 | `ACCOUNT_LOCKED` | Geçici kilit (`retryAfter` sn) |
| 429 | `RATE_LIMITED` | `Retry-After` header'ı |
| 502/503 | `UPSTREAM_ERROR` / `SERVICE_UNAVAILABLE` | Entegrasyon testi vb. |
| 500 | `INTERNAL_ERROR` | Genel |

Başarılı yanıtlar: tekil `{ "data": {...} }`; liste `{ "data": [...], "meta": { "page", "pageSize", "total" } }`. Boş koleksiyon: `200` + `"data": []` (Şartname §3.3).

---

## 11. Veri saklama ve KVKK

| Veri | Süre | Yöntem |
|---|---|---|
| ContactMessage | 12 ay | Günlük iş, kalıcı silme |
| AnalyticsEvent | 13 ay | Günlük iş (`retention.cleanup`, gece yarısı + açılışta) |
| DownloadEvent.visitorHash | 90 gün | `NULL`'lama (sayım korunur) |
| AuditLog | 24 ay | Günlük iş |
| AdminSession (süresi dolmuş/iptal) | 30 gün | Günlük iş |
| PasswordResetToken (kullanılmış/dolmuş) | 7 gün | Günlük iş |
| Günlük tuz (`dailySalt`) | 1 gün | Bellekte + DB'de tek satır, her gece üzerine yazılır |

Aydınlatma metni ve çerez politikası metinleri CMS üzerinden düzenlenebilir sistem içerikleridir (`LegalDocument`; CMS.md §1, ADMIN.md §3.13).
