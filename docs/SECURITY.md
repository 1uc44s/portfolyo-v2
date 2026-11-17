# SECURITY.md — Güvenlik Kontrolleri ve Test Sonuçları

> Şartname §27 teslim dokümanı. Kurallar: [RULES.md §5](RULES.md), gereksinimler: [SRS §9 (SEC-01..)](SRS.md). Son güncelleme: 2026-11-15 (F19).

## 1. Uygulanan kontroller (özet)

| Alan | Kontrol | Yer |
|---|---|---|
| Kimlik doğrulama | argon2id şifre özeti, zxcvbn güç kontrolü (≥ 12 karakter), hesap kilidi, TOTP 2FA + tek kullanımlık kurtarma kodları, kısa ömürlü JWT access + dönen refresh (yeniden kullanım tespiti → aile iptali) | `modules/auth` |
| Oturum çerezleri | `__Host-` önekli, `Secure`, `HttpOnly`, `SameSite=Strict`; CSRF double-submit (oturuma HMAC'li) + Origin kontrolü | `auth/cookies.js`, `middleware/originCheck.js` |
| Yetki | Rol + modül izinleri (`messages:read` vb.), süper admin işlemleri (L5) ayrı; her admin ucu `requirePermission` | `middleware/auth.js` |
| Girdi doğrulama | İstemci ve sunucuda aynı Zod şemaları (`packages/shared`), `.strict()` (fazla alan reddi) | tüm route'lar |
| SQL | Yalnızca Prisma / tagged `$queryRaw`; `$queryRawUnsafe` yok | — |
| XSS | `dangerouslySetInnerHTML` yasak (lint), Markdown `SafeMarkdown` (HTML yok, güvenli link protokolleri), dış URL'ler yalnızca `https:`/`http:` | `SafeMarkdown`, `integrations/http.js` |
| CSP | Public: hash'li inline script, `object-src 'none'`, `frame-ancestors 'none'`; API: `default-src 'none'`; GitHub SVG kartları ayrıca kısıtlı CSP + `<img>` | `deploy/Caddyfile`, `securityHeaders.js` |
| Dosya yükleme | Uzantı allowlist + magic bytes + MIME eşleşmesi + yeniden kodlama (metadata temizlenir), SVG yasak, sunucu üretimli depo anahtarı, `spawn` (shell yok) | `modules/media` |
| Rate limit | Giriş, 2FA, şifremi unuttum, iletişim (3/10 dk, 10/gün), indirme, çerez izni, analitik, genel public/admin | `middleware/rateLimit.js` |
| Bot koruması | Cloudflare Turnstile (sunucu doğrulaması, fail-closed): iletişim formu + admin girişi (şifreden önce); iletişimde ayrıca honeypot | `lib/turnstile.js`, `auth/routes.js` |
| Secret'lar | Env Zod doğrulaması (zayıf/eksikse açılmaz); DB'deki secret'lar AES-256-GCM; API'de yalnızca `isSet`; loglarda redaksiyon | `config/env.js`, `lib/crypto.js` |
| Kişisel veri | Ziyaretçi IP'si saklanmaz (günlük tuzlu HMAC), analitik yalnızca izinle, saklama süreleri (SRS §11), audit metadata'sında içerik yok | `jobs/dailySalt.js`, `analytics` |
| Açık yönlendirme | `next` yalnızca `/admin` ile başlayan göreli yollar | `safeNextPath` |
| SSRF | Dış servis host'ları sabit/env; kullanıcı girdisi yalnızca encode edilmiş sorgu parametresi | `integrations/providers` |

## 2. Test sonuçları (2026-11-15)

| Test | Sonuç |
|---|---|
| Otomatik testler | **Depoda test dosyası ve `test` betiği yok** (2026-11-17 kontrolü); `npm run verify` yalnızca TS yok kontrolü + lint + format + build çalıştırır. Aşağıdaki liste planlanan kapsamdır: Güvenlik ağırlıklı olanlar: yetki matrisi (403), CSRF/Origin, rate limit (429 + Retry-After), honeypot, Turnstile 422/503, secret'ların yanıtta/DB düz metinde olmaması, audit redaksiyonu, Spotify `state` imza/süre, dış URL protokol filtresi |
| E2E + erişilebilirlik (`PW_CHANNEL=chrome npm run e2e`) | 27/27 geçti: 6 sayfa × 6 genişlik yatay taşma yok, axe WCAG 2.2 AA kritik/ciddi ihlal 0, klavye turu, çerez reddinde analitik isteği yok |
| Bağımlılık taraması (`npm audit`) | **0 açık** (discord.js 14.28.1'e yükseltilerek undici açıkları kapatıldı) |
| Statik kontrol (RULES §5) | `dangerouslySetInnerHTML` 0, `$queryRawUnsafe` 0, shell `exec` 0, güvenlik mantığında `Math.random` 0, build çıktısında secret 0 |
| Yedek geri yükleme provası | DB 32 tablo + 3 migration eşleşti; medya sha256 eşleşti |

### Bulunan ve düzeltilen bulgular

| # | Bulgu | Önem | Düzeltme |
|---|---|---|---|
| 1 | discord.js içindeki undici: CRLF/başlık enjeksiyonu, TLS doğrulama atlatma vb. | Yüksek | discord.js 14.28.1 |
| 2 | Dış servis URL'leri (GitHub/Spotify/Discord) protokol kontrolsüz `href`/`src`'e yazılıyordu | Orta | Snapshot'a yalnızca `https:` girer |
| 3 | Kart dosya adı regex'inde kaçışsız nokta | Düşük | `\.svg` |
| 4 | Karşılama ekranının erişilebilir adı görünen metinle uyuşmuyordu (WCAG 2.5.3) | Erişilebilirlik | Ad = görünen metin |
| 5 | Audit eylem adları dokümanla uyuşmuyordu | Düşük | RULES §6 ile hizalandı |

## 3. Açık kalanlar (yayın öncesi/sonrası)

- **OWASP ZAP baseline** — staging alan adına karşı (`docker run ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://staging...`); yüksek/kritik bulgu kalmamalı.
- **Lighthouse** — prod build + HTTPS ile (PRD §5 hedefleri).
- **NVDA ekran okuyucu** elle turu.
- **CSP ihlal raporu** — yayından sonra tarayıcı konsolunda ihlal olmadığının kontrolü (gerekirse `report-to` eklenir).
- `/media` uçlarına rate limit gerekip gerekmediği trafiğe göre değerlendirilecek (şu an genel limit dışında).

## 4. Güvenlik açığı bildirimi

Site sahibine iletişim formundan "Güvenlik" konusuyla yazılır; ayrıntı ve kanıt herkese açık paylaşılmaz.
