# PRD — Product Requirements Document

> **Proje:** vasquez-portfolyo — Kişisel Portfolyo ve Dinamik Medya CMS
> **Sürüm:** 1.0 (v1 kapsamı) · **Durum:** Onaylı taslak · **Son güncelleme:** 2026-11-14

---

## 0. Bu doküman seti nasıl kullanılır (Single Source of Truth)

`/docs` dizini projenin **tek doğruluk kaynağıdır**. Kural:

1. Yeni özellik veya değişiklik **önce** ilgili dokümana işlenir, **sonra** kodlanır.
2. Kod ile doküman çelişirse doküman doğrudur; kod düzeltilir veya doküman bilinçli olarak güncellenir (ikisi aynı commit'te).
3. Şartname, ürün sahibinden gelen **girdi**dir. `/docs` altındaki dokümanlar onu uygulanabilir kararlara çevirir. Şartname ile bu set çelişirse önce ürün sahibine sorulur, karar buraya yazılır.

| Doküman | Ne cevaplar |
|---|---|
| [PRD.md](PRD.md) | Ne yapıyoruz, kimin için, başarı nedir |
| [SRS.md](SRS.md) | Sistem tam olarak ne yapmalı (FR/NFR) |
| [DATABASE.md](DATABASE.md) | Veri modeli, index, FK, cascade |
| [ERD.md](ERD.md) | İlişki diyagramı (Mermaid) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Dizinler, auth akışı, PWA, oturum, medya hattı |
| [ROUTES.md](ROUTES.md) | Tüm frontend route'ları ve API endpoint'leri |
| [CMS.md](CMS.md) | İçerik modülleri, sistem şablonları, şablon motoru |
| [ADMIN.md](ADMIN.md) | Roller, yetki matrisi, modül yetkisi atama |
| [RULES.md](RULES.md) | Kod standartları, güvenlik kuralları, tasarım sistemi kuralları |

### 0.1 Şablon uyarlama notu

Doküman iskeleti genel bir şablondan geldi. Bu projeye uymayan kavramlar şu şekilde karşılandı:

| Şablondaki kavram | Bu projedeki karşılığı |
|---|---|
| PDO (PHP) ile SQL injection koruması | Prisma parametreli sorgular; `$queryRawUnsafe` yasak (RULES.md §4) |
| Müfredat ders/konu tanımlama | İçerik taksonomisi: Kategori ve Proje tanımlama (CMS.md §3) |
| WhatsApp şablon motoru | Genel e-posta şablon motoru (bildirim + `mailto:` yanıt). WhatsApp entegrasyonu yok (CMS.md §6) |
| Branş atama | Modül yetkisi atama: EDITOR rolüne modül kapsamı verme (ADMIN.md §4) |
| PWA yaşam döngüsü | Şartnamede yok; **opsiyonel faz** olarak tanımlandı (ARCHITECTURE.md §6) |

---

## 1. Ürün vizyonu

Ziyaretçinin siteye girdiği an **bir kişinin dijital odasına** girdiğini hissettiği, her gün kendini yenileyen (arka plan, müzik, profil fotoğrafı, imleç) atmosferik bir kişisel portfolyo. Arkasında, sahibinin hiçbir satır kod yazmadan her şeyi yönetebildiği güvenli bir CMS.

**Tek cümle:** "Kendini her gün yenileyen, canlı durumlarını gösteren, içeriğini kendisi yöneten kişisel dijital kimlik sayfası."

### 1.1 Problem

- Statik portfolyolar hızla bayatlar; güncellemek kod değişikliği ister.
- "Bio link" servisleri kişiselleştirme ve sahiplik vermez, medya indirme sunmaz.
- Canlı durumlar (Discord, Spotify, GitHub) dağınık; tek yerde ve güvenli toplanmaz.

### 1.2 Çözüm ilkeleri

1. **İçerik koddan ayrıdır.** Public site, backend'den gelen ayarla çizilir. Hard-coded içerik yoktur (istisna: Tech Stack placeholder'ı ve sistem metinleri).
2. **Boşluk göstermeyiz.** İçeriği olmayan bölüm/sayfa görünmez (navbar dahil).
3. **Güvenlik temeldir, sonradan eklenmez.**
4. **Atmosfer, erişilebilirlikten ödün vermez.** Her efektin düşük efekt / reduced-motion karşılığı vardır.

---

## 2. Hedef kitle ve personalar

| Persona | Kim | İhtiyaç | Başarı anı |
|---|---|---|---|
| **Ziyaretçi** | Profili Discord/sosyal medyadan tıklayan kişi | Kim olduğunu hızlı anlamak, havayı hissetmek, link bulmak | "Click to enter" sonrası müzik + arka plan birlikte açılır |
| **İndirici** | Duvar kağıdı / pfp arayan kişi | Hızlı önizleme, tek tıkla indirme | Video önizleme oynar, İndir butonu dosyayı verir |
| **İşveren / iş birliği** | Proje görmek isteyen | Proje detayı, demo/GitHub linki, iletişim | Proje detayından iletişim formuna geçer |
| **Sahip (Süper Admin)** | Site sahibi | Kod yazmadan her şeyi güncellemek, güvende olmak | Yeni arka plan yükler, progress bar biter, sitede görünür |
| **Editör (opsiyonel)** | Sahibin yetki verdiği kişi | Yalnızca atanmış modülleri yönetmek | Kendi modülü dışında hiçbir şey göremez |

---

## 3. Kapsam

### 3.1 v1 kapsamında (zorunlu)

**Public:** Welcome overlay, Hero, global müzik oynatıcı, Discord/Spotify/GitHub durum kartları, Tech Stack placeholder, Projeler (liste + detay), Hakkımda, Linkler, İletişim formu, Footer, `/wallpapers`, `/pfps`, Dark/Light, Glass/Classic, düşük efekt modu, çerez izin yönetimi.

**Admin:** Login (+2FA, şifremi unuttum, beni 7 gün hatırla), Dashboard, Site Ayarları, Hero, Medya Yönetimi (arka plan, müzik, pfp, cursor seti (arka planlar duvar kağıdı olarak işaretlenebilir), proje görselleri, link görselleri), Durumlar, Projeler, Kategoriler, Linkler, İletişim Mesajları, Hesap Ayarları, Sistem Ayarları, Güvenlik ve İşlem Logları.

**Sistem:** Medya hattı (doğrulama, magic bytes, EXIF temizleme, WebP, FFmpeg, thumbnail), günlük rotasyon cron'u, indirme sayacı, audit log, rate limit, CAPTCHA, saklama süresi temizlik işleri.

### 3.2 v1 kapsamı dışında

- SEO title/description/OG yönetimi (Şartname §19 — işaretsiz). Not: favicon **kapsamda**.
- SSR / prerender.
- Çoklu dil (i18n). Arayüz Türkçe; yalnızca Welcome metni şartname gereği İngilizce.

### 3.3 En son yapılacak (kabul kriteri)

- Tech Stack bölümünün gerçek içeriği. O zamana kadar yalnızca başlık + `Coming soon`.

### 3.4 Opsiyonel (v1.x)

- PWA (kurulabilir kabuk, offline fallback) — ARCHITECTURE.md §6.
- EDITOR rolü yönetim arayüzü — ADMIN.md §4.
- İletişim mesajı e-posta bildirimi — CMS.md §5.

---

## 4. Kullanıcı hikayeleri ve kabul kriterleri

Format: **US-ID** · hikaye · kabul kriterleri (AC). Her AC test edilebilir olmalıdır ve TODO.md test adımlarına bağlanır.

### 4.1 Ziyaretçi

**US-01 Welcome ve müzik başlangıcı**
Ziyaretçi olarak, siteye girdiğimde bir karşılama ekranı görmek ve tıkladığımda müziğin başlamasını istiyorum.
- AC1: İlk açılışta tam ekran siyah yarı saydam overlay ve ortada `Welcome, click to enter...` görünür.
- AC2: Tıklama, Enter veya Space ile overlay animasyonla kapanır (reduced-motion'da kısa opacity geçişi).
- AC3: Aktif müzik varsa etkileşimden sonra %60 sesle başlar; etkileşimden önce ses denenmez.
- AC4: Ziyaretçi daha önce sesi değiştirdiyse kayıtlı seviye kullanılır; müziği durdurduysa otomatik başlatılmaz.
- AC5: Aktif müzik yoksa overlay yine kapanır, hata gösterilmez.

**US-02 Kesintisiz müzik**
Sayfalar arasında gezerken müziğin kesilmemesini istiyorum.
- AC1: `/` ↔ `/wallpapers` ↔ `/pfps` ↔ `/projects/:slug` geçişlerinde `currentTime` sıfırlanmaz.
- AC2: Tek bir `<audio>` elemanı vardır (DOM'da doğrulanır).
- AC3: Oynatıcıda kapak, ad, sanatçı, ±5 sn, oynat/durdur, ses, ilerleme, geçen/toplam süre, skeleton ve hata durumu vardır.

**US-03 Günün atmosferi**
Her gün farklı bir arka plan, müzik, profil fotoğrafı ve imleç görmek istiyorum; başka bir ziyaretçi de aynı gün aynısını görmeli.
- AC1: Aynı takvim günü (Europe/Istanbul) tüm ziyaretçiler aynı dört seçimi görür.
- AC2: Hareketli medya (MP4/GIF) loop yapar, video sessizdir; statik görsel loop yapmaz.
- AC3: Dokunmatik cihazda (`pointer: coarse`) özel imleç uygulanmaz.

**US-04 Canlı durumlar**
Sahibin Discord durumunu, Spotify'da ne dinlediğini ve GitHub istatistiklerini görmek istiyorum.
- AC1: Kapalı entegrasyon kartı render edilmez.
- AC2: Servis hatasında kart kontrollü hata/gizli durumuna geçer, sayfanın geri kalanı çalışır.
- AC3: Spotify bir şey çalmıyorsa `Şu anda müzik dinlemiyor` görünür.
- AC4: API'nin sağlamadığı alan (ör. Discord bio) için uydurma veri gösterilmez.

**US-05 Projeler**
- AC1: Yayında proje yoksa Projeler bölümü render edilmez.
- AC2: Kart → `/projects/:slug` detay; görseller, kategoriler, açıklama, linkler.
- AC3: Yayında olmayan veya var olmayan slug → 404 ekranı (uygulama çökmez).
- AC4: Harici linkler `target="_blank" rel="noopener noreferrer"`.

**US-06 Linkler**
- AC1: Bölüm Hakkımda'nın hemen altında, İletişim'in üstündedir; başlık `Linkler`.
- AC2: Kartın tamamı tıklanabilir; görsel solda, başlık hemen yanında.
- AC3: Masaüstünde satırda en fazla 6 kart; her satırın eksik kartları ortalanır (1, 2, 7, 8, 13, 14 senaryoları).
- AC4: Aktif link yoksa bölüm hiç render edilmez.
- AC5: Yatay scroll oluşmaz (320 px genişlik dahil).

**US-07 Duvar kağıtları / Profil fotoğrafları**
- AC1: Sayfa açılınca sorumluluk uyarısı; kapatılınca içerik görünür.
- AC2: Masaüstünde `/wallpapers` 3, `/pfps` 4 sütun; ID'ye göre artan sıra.
- AC3: Medya alanına tıklama → büyük önizleme modalı; MP4 gerçek video olarak oynar.
- AC4: İndir butonu doğru MIME ve güvenli dosya adıyla dosyayı indirir.
- AC5: Aktif+indirilebilir içerik yoksa navbar linki gizli; doğrudan ziyarette açıklayıcı boş durum.

**US-08 İletişim**
- AC1: İsim, soyisim, telefon (opsiyonel), e-posta, konu, açıklama alanları; backend validasyonu. Telefon girilmemişse admin panelinde gösterilmez.
- AC2: CAPTCHA zorunlu; IP başına rate limit.
- AC3: Başarı/başarısızlık bildirimi; mesaj admin paneline düşer.

**US-09 Görünüm tercihleri**
- AC1: Dark/Light ve Glass/Classic tercihleri saklanır, yenilemede korunur, ilk boyamada yanıp sönme (FOUC) olmaz.
- AC2: Düşük efekt modu parçacıkları, yıldızları, arka plan videosunu (poster'a düşer) ve ağır geçişleri kapatır; içerik kaybı olmaz.
- AC3: `prefers-reduced-motion: reduce` varsayılan olarak düşük efekt modunu açar (kullanıcı yine değiştirebilir).

**US-10 Çerezler**
- AC1: Banner içeriği kapatmaz; Kabul et / Reddet / Tercihler seçenekleri eşit görsel ağırlıktadır.
- AC2: Analitik izni verilmeden analitik olayı gönderilmez.
- AC3: Tercih footer'daki "Çerez tercihleri" linkiyle sonradan değiştirilebilir.

### 4.2 Admin

**US-20 Güvenli giriş**
- AC1: `/admin/login` başlığı `Hoşgeldiniz...`; e-posta, şifre, Beni 7 gün hatırla, Şifremi unuttum, Giriş yap.
- AC2: Hesap başına 5 başarısız deneme / 15 dk → geçici kilit; IP bazlı limit ayrıca uygulanır.
- AC3: 2FA açıksa TOTP veya kurtarma kodu adımı zorunlu.
- AC4: Logout sonrası eski refresh token kullanılamaz.

**US-21 İlk kurulum**
- AC1: İlk admin yalnızca sunucuda çalıştırılan CLI ile oluşturulur; HTTP kurulum endpoint'i yoktur.
- AC2: Geçici şifreyle oluşturulan hesap ilk girişte şifre değiştirmeden panel kullanamaz.
- AC3: Sistemde zaten SUPER_ADMIN varsa CLI `--force` olmadan çalışmaz.

**US-22 Medya yükleme**
- AC1: Yüklemede gerçek ilerleme çubuğu (byte bazlı).
- AC2: Uzantı + MIME + magic bytes uyuşmazsa 415/422 ve açıklayıcı mesaj.
- AC3: Görsellerde EXIF temizlenir; WebP üretilir; video için poster/thumbnail üretilir.
- AC4: Silmede DB kaydı ve fiziksel dosya tutarlı temizlenir; kullanımdaki medya silinemez (hangi kayıtta kullanıldığı gösterilir).

**US-23 Rotasyon kontrolü**
- AC1: Site Ayarları'nda dört kategori için "şu an aktif" içerik ve kaynağı (Otomatik / Manuel) görünür.
- AC2: Manuel seçim bir sonraki 00:00 (İstanbul) cron'una kadar geçerlidir; "Otomatiğe dön" ile hemen kaldırılır.

**US-24 Proje & kategori**
- AC1: Kategori adı zorunlu, büyük/küçük harf duyarsız benzersiz (Türkçe `İ/i`, `I/ı` dahil).
- AC2: Kullanımdaki kategori silinirken ya yeniden kategorilendirme seçilir ya da silme engellenir.
- AC3: Proje: başlık + açıklama zorunlu; demo/video/GitHub'dan en az biri zorunlu; slug otomatik, düzenlenebilir, benzersiz.

**US-25 Linkler**
- AC1: Görsel, başlık, URL zorunlu; başlık tekrarı serbest.
- AC2: Yalnızca `http`/`https`; `javascript:`, `data:`, `vbscript:`, `file:` reddedilir.
- AC3: Sürükle-bırak sıralama; public önizleme paneli.

**US-26 Audit**
- AC1: Şartname §17.1'deki tüm olaylar loglanır.
- AC2: Log metadata'sında secret/token/şifre bulunmaz (otomatik test ile doğrulanır).

**US-27 Hesap ayarları**
- AC1: E-posta/şifre değişimi mevcut şifre ister.
- AC2: SMTP uygulama anahtarı yoksa "Şifremi unuttum e-postası çalışmaz" uyarısı görünür; SMTP bağlantı testi vardır.
- AC3: Uygulama anahtarı hiçbir yanıtta geri dönmez (yalnızca `isSet: true/false`).

---

## 5. Başarı metrikleri

| Metrik | Hedef | Ölçüm |
|---|---|---|
| LCP (ana sayfa, 4G mobil) | ≤ 2.5 sn | Lighthouse |
| CLS | ≤ 0.05 | Lighthouse |
| INP | ≤ 200 ms | Lighthouse |
| İlk JS bundle (public, gzip) | ≤ 180 KB | Vite build raporu |
| Admin kodu public bundle'a sızması | 0 | Build analizi (lazy chunk) |
| Lighthouse Accessibility | ≥ 95 | Lighthouse |
| Public API p95 (cache'li) | ≤ 150 ms | Sunucu logları |
| Entegrasyon kesintisinde sayfa hatası | 0 | Kaos testi (servisi kapat) |
| Public yanıtlarda secret sızıntısı | 0 | Otomatik test |
| Admin içerik güncelleme süresi | Kod değişikliği olmadan < 2 dk | Manuel senaryo |
| Rotasyon döngü içi tekrar | 0 | Birim + entegrasyon testi |

---

## 6. Tasarım vizyonu

Tasarım bu projede birinci sınıf gereksinimdir. Token ve ölçü kuralları RULES.md §8'dedir; burada **his ve yön** tanımlanır.

### 6.1 Yön: "Gece Camı"

- **Sahne:** Günün arka plan medyası tüm ekranı kaplar. İçerik bu sahnenin önünde yüzen cam panellerde durur. Arka plan ile bileşenler arasında saydam örtü (scrim) **yoktur** (2026-11-16); okunurluğu cam paneller sağlar.
- **Karakter:** Koyu öncelikli (dark-first), sakin, sinematik. Parlaklık yalnızca anlam taşıyan yerde: isim efekti, aktif durum noktası, hover parlaması.
- **Tek vurgu rengi:** Soğuk mor-mavi ("iris"). Durum renkleri (online/idle/dnd/offline) Discord semantiğiyle eşleşir ama vurguyla yarışmaz.
- **Tipografi:** Gösterim (isim, bölüm başlıkları) için Bricolage Grotesque, arayüz metni için Geist, zaman/sayaç/meta için Geist Mono. Fontlar self-host edilir (KVKK: üçüncü taraf font CDN'ine IP gönderilmez).
- **Ritim:** Ana sayfa tek sütunlu, ortalanmış bir "profil yığını". Bölümler arası boşluk cömert; her şey 4/8 px ızgarasına oturur.
- **Hareket:** Kısa, amaçlı, yumuşak çıkışlı girişler (stagger ile). Hiçbir bilgi yalnızca animasyonla iletilmez.

### 6.2 Ana sayfa kompozisyonu (masaüstü)

```
┌────────────────────────── Navbar (glass/classic, sticky) ──────────────────────────┐
│                                                                                    │
│                  [ Profil fotoğrafı (halka + Discord durum noktası) ]              │
│                              İSİM (seçili efektler)                                │
│                          slogan  ·  konum                                          │
│                                                                                    │
│        ┌──────────── Müzik oynatıcı (cam şerit, içerik genişliği) ────────────┐    │
│                                                                                    │
│        ┌── Discord ──┐    ┌── Spotify ──┐    ┌── GitHub ──┐   (bento, 3 sütun)     │
│                                                                                    │
│                         Tech Stack — "Coming soon"                                 │
│        Projeler (kart ızgarası, 3 sütun)                                           │
│        Hakkımda (okuma genişliği ≤ 68ch)                                           │
│        Linkler (flex, satır başı ≤ 6, ortalı)                                      │
│        İletişim (form, alanlar 2 sütun)                                            │
└──────────────────────── Footer (teknolojiler · © yıl isim) ────────────────────────┘
```

Mobilde her şey tek sütuna akar; durum kartları dikey yığılır; oynatıcı ekran altına yapışık mini moda geçebilir (içerik üstünü kapatmaz, `padding-bottom` ile yer açılır).

### 6.3 Durum tasarımı zorunluluğu

Her modül için dört durum tasarlanır: **yükleniyor (skeleton)**, **boş**, **hata**, **başarılı**. Skeleton gerçek içeriğin ölçülerini korur (CLS önlenir). Public sitede "boş" durumu çoğu bölüm için "render etme" anlamına gelir (bkz. SRS FR-PUB-03).

### 6.4 Admin paneli hissi

Public sitenin kimliğini taşır ama bir **araçtır**: daha yoğun, daha sakin, okunurluk öncelikli. Cam efekti yalnızca üst bar ve sidebar'da (Glass modunda); formlar ve tablolar düz yüzeydedir. Admin'de arka plan medyası gösterilmez.

---

## 7. Varsayımlar ve riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Discord bot'u bio/dekorasyon alanlarına erişemeyebilir | Kart eksik alanlı | Erişilemeyen alan gizlenir, uydurulmaz (SRS FR-INT-D) |
| Spotify "top tracks" ek scope ve politika kısıtı | Alt bölüm boş kalabilir | Bağlanırken scope doğrulanır; yoksa alt bölüm gizli |
| Üçüncü taraf GitHub istatistik servisi çökebilir | Görsel kırılır | Backend proxy + cache + sabit yükseklikli fallback |
| Büyük video yüklemeleri sunucuyu yorar | Yavaşlık | Arka plan iş kuyruğu, eşzamanlı en fazla 1 FFmpeg işi |
| Ephemeral disk (PaaS) | Medya kaybı | Prod'da kalıcı disk veya S3 uyumlu storage zorunlu |
| Tarayıcı autoplay politikaları | Müzik başlamaz | Yalnızca kullanıcı etkileşiminden sonra `play()` |
| Tek sunucu varsayımı (in-memory rate limit/cache) | Yatay ölçekte tutarsızlık | v1 tek instance; çoklu instance'a geçişte Redis (ARCHITECTURE §9) |

---

## 8. Sözlük

- **Rotasyon kategorisi:** BACKGROUND, MUSIC, PFP, CURSOR.
- **Döngü (cycle):** Bir kategorideki tüm uygun içeriklerin birer kez seçildiği periyot.
- **Override:** Admin'in rotasyon seçimini bir sonraki cron'a kadar ezmesi.
- **Public-visible:** `isActive = true` olan kayıt; indirme sayfaları için ayrıca `isDownloadable = true`.
- **Düşük efekt modu:** Kullanıcı tercihli veya reduced-motion kaynaklı hafif görünüm.
- **Scrim:** Arka plan medyasının üstüne binen, okunurluğu sağlayan koyu gradyan katman.
