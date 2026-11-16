# ADMIN — Yönetim Paneli, Roller ve Yetkiler

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Bağlı: ROUTES.md §1–2, §4 · SRS.md §3
> **Uyarlama notu:** Şablondaki "branş atama mekanizması" bu projede **modül yetkisi atama** olarak karşılanmıştır: EDITOR rolündeki bir yöneticiye hangi CMS modüllerini yönetebileceği atanır (§4).

---

## 1. Roller

| Rol | Kim | v1 durumu |
|---|---|---|
| **SUPER_ADMIN** | Site sahibi. Tüm yetkiler + sistem, güvenlik, yönetici ve secret yönetimi. | **Zorunlu.** İlk hesap CLI ile oluşturulur. |
| **EDITOR** | Sahibin içerik yönetimi için yetkilendirdiği kişi. Yalnızca atanmış modüller. | **Opsiyonel faz.** Şema ve API middleware'i v1'de hazırdır; yönetim ekranı Faz 18'de. |

Ziyaretçi (anonim) bir rol değildir; yalnızca L0 public uçlarına erişir.

---

## 2. Süper Admin yetkileri

### 2.1 Yalnızca SUPER_ADMIN'e özel (atanamaz)

- Yönetici oluşturma, rol/yetki değiştirme, pasife alma, silme, başkasının 2FA'sını sıfırlama
- Entegrasyon **secret'larını** girme/değiştirme (Discord bot token, Spotify client secret, Spotify bağlantısı)
- SMTP / mail uygulama anahtarı yapılandırması
- Sistem işleri: manuel iş tetikleme, Tech Stack yayın anahtarı
- Audit log CSV dışa aktarımı
- Diğer yöneticilerin oturumlarını sonlandırma

### 2.2 Koruma kuralları

1. Sistemde her zaman **en az bir aktif SUPER_ADMIN** bulunur. Son SUPER_ADMIN pasife alınamaz, EDITOR'a düşürülemez, silinemez (`409 LAST_SUPER_ADMIN`).
2. Bir yönetici kendi rolünü değiştiremez, kendini silemez ve pasife alamaz.
3. Rol/yetki değişikliğinde hedefin tüm oturumları sonlanır (yeni yetkiler yeni token'da).
4. SUPER_ADMIN hesaplarında 2FA **önerilir**; Dashboard'da 2FA kapalıysa kalıcı uyarı kartı gösterilir: "Hesabında iki aşamalı doğrulama kapalı."
5. Yeni yönetici geçici şifreyle oluşturulur (16 karakter, yalnızca bir kez gösterilir, kopyala butonu), `mustChangePassword = true`.

### 2.3 Hesap kurtarma

| Durum | Yol |
|---|---|
| Şifre unutuldu, SMTP var | Şifremi unuttum akışı |
| Şifre unutuldu, SMTP yok | Sunucuda `npm run admin:reset-password -w backend -- --email <e>` CLI (geçici şifre, `mustChangePassword`) |
| 2FA cihazı kayıp | Kurtarma kodu ile giriş → 2FA yeniden kur. Kod da yoksa: başka SUPER_ADMIN `reset-2fa` veya CLI `admin:reset-2fa` |
| Tek SUPER_ADMIN kilitlendi | CLI ile kilidi aç: `admin:unlock` |

Tüm CLI işlemleri audit log'a `actor: "cli"` metadata'sıyla yazılır.

**Yalnızca geliştirme:** `npm run admin:dev-set -w backend -- --email <e>` — şifre stdin'den (gizli) okunur. Hesap yoksa SUPER_ADMIN oluşturur, varsa şifresini değiştirir; `mustChangePassword=false`, tüm oturumlar kapanır. Uzunluk kuralı 12 yerine **8** karakter (2026-11-15 kullanıcı kararı); zxcvbn güç kontrolü aynen uygulanır. `NODE_ENV=production` ise çalışmaz. Prod şifre kuralı (≥ 12) değişmez; dev şifresi prod'da kullanılamaz.

---

## 3. Panel yapısı ve ekranlar

### 3.1 Genel yerleşim

```
┌─────────────┬──────────────────────────────────────────────────────────┐
│  Logo/Başlık│  Topbar: sayfa başlığı · breadcrumb    [☾/☀] [Glass/Classic] [👤 menü] │
│─────────────│──────────────────────────────────────────────────────────│
│ Sidebar     │                                                          │
│  (12 öğe)   │  İçerik alanı (maks. 1280 px, 24 px iç boşluk)            │
│             │                                                          │
│  rozetler:  │                                                          │
│  Mesajlar(3)│                                                          │
│─────────────│                                                          │
│ v1.0 · çıkış│                                                          │
└─────────────┴──────────────────────────────────────────────────────────┘
```

- Sidebar: 256 px; `lg` altında gizlenir ve hamburger ile `Sheet` drawer olarak açılır. Daraltılmış mod (ikon-only, 72 px) tercih olarak saklanır.
- Topbar'da Dark/Light ve Glass/Classic kontrolleri (Şartname §15.1) — public tercihlerle **aynı** store'u kullanır.
- Kullanıcı menüsü: Hesap Ayarları, Siteyi görüntüle (yeni sekme), Çıkış.
- Komut paleti (`Ctrl/⌘ K`): menü öğelerine ve "Yeni proje", "Yeni link", "Arka plan yükle" eylemlerine hızlı erişim. GEREKLİ

### 3.2 Sidebar menüsü (Şartname §15.2 sırası) ve izin anahtarları

| # | Menü | Path | İkon (Lucide) | Gerekli izin |
|---|---|---|---|---|
| 1 | Dashboard | `/admin` | `LayoutDashboard` | `dashboard:read` |
| 2 | Site Ayarları | `/admin/settings` | `Settings2` | `settings:read` |
| 3 | Hero Section | `/admin/hero` | `UserRound` | `hero:read` |
| 4 | Medya Yönetimi | `/admin/media` | `Images` | `media:read` |
| 5 | Durumlar | `/admin/status` | `Activity` | `status:read` |
| 6 | Projeler | `/admin/projects` | `FolderKanban` | `projects:read` |
| 7 | Kategoriler | `/admin/categories` | `Tags` | `categories:read` |
| 8 | Linkler | `/admin/links` | `Link2` | `links:read` |
| 8b | Tech Stack (F21) | `/admin/tech-stack` | `Layers` | `settings:read` |
| 9 | İletişim Mesajları | `/admin/messages` | `Inbox` | `messages:read` |
| 10 | Hesap Ayarları | `/admin/account` | `ShieldCheck` | — (herkes, kendi hesabı) |
| 11 | Sistem Ayarları | `/admin/system` | `Wrench` | `system:read` (bazı sekmeler L5) |
| 12 | Güvenlik ve İşlem Logları | `/admin/audit` | `ScrollText` | `audit:read` |

İzni olmayan öğe sidebar'da **gösterilmez**; URL ile doğrudan girilirse "Bu sayfaya erişim yetkin yok." ekranı (403).

### 3.3 Dashboard
Üst satır KPI kartları (Toplam ziyaretçi · Bugün · Bu hafta · Bu ay — "izinli ziyaretçiler" alt etiketi), ziyaretçi alan grafiği (7/30/90 gün), "En çok indirilenler" iki sütun (wallpaper, pfp; küçük resim + sayı), "En çok görüntülenen projeler", "Son işlemler" (audit'ten 10 kayıt), "Entegrasyonlar" (3 durum noktası + son senkron), "Depolama" (tür bazında yığılmış çubuk). Güvenlik uyarı kartları: 2FA kapalı, SMTP yok, entegrasyon hatası, başarısız medya işleme.

### 3.4 Site Ayarları — CMS.md §9
### 3.5 Hero Section
Form solda; sağda **canlı önizleme** (gerçek `Hero` bileşeni, sahne arka planı dahil). Efekt seçimi çoklu toggle çipleri (Neon, Gradyan, Hareketli gradyan, İsim GIF'i); gradyan için iki renk seçici (sol / sağ — iki gradyan türü için ortak). İsim GIF'leri Medya > İsim efektleri sekmesinden yüklenir (rotasyonlu). Aynı ekranın altında **Yağan öğeler** kartı: görsel veya metin öğe ekle/düzenle/sil/sırala, boyut, aktif; "Düşük efekt modunda önizle" anahtarı. Profil kaynağı: radyo (Günlük rotasyon / Sabit görsel) + sabit görsel seçici.

### 3.6 Medya Yönetimi — CMS.md §8
### 3.7 Durumlar
Üç sekme/kart (Discord, Spotify, GitHub). Her kartta: Aç/Kapat anahtarı, yapılandırma alanları, secret alanları (yalnızca SUPER_ADMIN için düzenlenebilir; değer gösterilmez, "Ayarlı ✓ · Değiştir" deseni), "Bağlantıyı test et", "Şimdi senkronize et", son başarılı güncelleme, son hata (kırmızı kutu, kopyalanabilir), public kart önizlemesi.
- Discord: Bot token, Kullanıcı ID, hitap şekli; kurulum yardımı (gerekli intent'ler, botun ortak sunucuda olması).
- Spotify: Client ID, Client Secret, Redirect URI (salt okunur, kopyala), "Spotify ile bağlan" / "Bağlantıyı kes", verilen scope listesi.
- GitHub: Kullanıcı adı; istatistik kartları önizlemesi.

### 3.8 Projeler / 3.9 Kategoriler — CMS.md §3
### 3.10 Linkler
Sol: sıralanabilir liste (görsel, başlık, URL kısaltılmış, aktif anahtarı). Sağ: **public önizleme paneli** — gerçek `LinksSection` bileşeni; genişlik simülatörü (Masaüstü 1280 / Tablet 768 / Mobil 375) ile satır kırılması ve ortalama anında görülür. Form: görsel (zorunlu, kare kırpma önerisi), başlık (zorunlu), URL (zorunlu; yazarken protokol uyarısı).

### 3.10b Tech Stack (F21, `settings:*`)
Solda: yayın anahtarı, merkez başlık (3 satır) (amblem 2026-11-16'da kaldırıldı); öğe listesi (sürükle-bırak sıra = numara, görsel, etiket, aktif anahtarı, düzenle/sil; en fazla 9). Öğe formu: görsel (kare/dairesel önerilir, şeffaf PNG en iyisi), etiket, açıklama ("bununla ne yapıyorum"). Sağda: gerçek public bileşenle canlı önizleme (öğeye tıklayınca açıklama).

### 3.11 İletişim Mesajları
İki panelli gelen kutusu: liste (okunmamış kalın, durum rozetleri) + detay (gönderen bilgileri, mesaj, "E-posta ile yanıtla", Yanıtlandı/Bekliyor, Spam işaretle, Sil). Klavye: `j/k` gezin, `e` yanıtlandı, `s` spam.

### 3.12 Hesap Ayarları
Sekmeler: Profil · E-posta · Şifre · E-posta Gönderimi (SMTP — yalnızca SUPER_ADMIN düzenler; diğerleri durumu görür) · İki Aşamalı Doğrulama · Oturumlar.
SMTP tanımlı değilse sayfanın üstünde uyarı: "E-posta gönderimi ayarlanmadı. Şifremi unuttum e-postaları gönderilemez."

### 3.13 Sistem Ayarları (sekmeler)

| Sekme | İçerik | Katman |
|---|---|---|
| Rotasyon | 4 kategori döngü durumu, "Şimdi yeniden seç", son cron çalışması | `settings:write` |
| Şablonlar | `MessageTemplate` düzenleyici + önizleme | `system:write` |
| Yasal metinler | KVKK aydınlatma, Çerez politikası (sürüm artır anahtarı) | `system:write` |
| Özellikler | E-posta bildirimi | L5 |
| Yöneticiler | Liste, oluştur, rol/modül ata, pasife al, 2FA sıfırla | L5 |
| İşler | Zamanlanmış işler tablosu, manuel tetik | L5 |
| Depolama | Kullanım, yetim medya sayısı, bekleyen silme işleri | `media:read` |
| Tech Stack | Yayın anahtarı (son faza kadar kilitli; açıklama metni) | L5 |

### 3.14 Güvenlik ve İşlem Logları
Filtrelenebilir tablo (tarih aralığı, yönetici, eylem, varlık). Satır genişletildiğinde metadata JSON (redakte edilmiş) gösterilir. Güvenlik olayları (başarısız giriş, reuse, kilit) kırmızı vurgulu. CSV dışa aktar (L5).

---

## 4. Rol matrisi ve modül yetkisi atama

### 4.1 İzin anahtarları

Biçim: `<modül>:<eylem>`, eylem ∈ `read`, `write`. `write` → `read`'i kapsar.

| Modül | Kapsam |
|---|---|
| `dashboard` | Dashboard (yalnızca `read`) |
| `settings` | Site ayarları, hakkımda, footer, favicon, rotasyon override |
| `hero` | Hero |
| `media` | Arka plan (duvar kağıdı anahtarı dahil), müzik, pfp, cursor, kütüphane |
| `status` | Entegrasyon aç/kapa, config, test, sync (secret hariç) |
| `projects` | Projeler + proje görselleri |
| `categories` | Kategoriler |
| `links` | Linkler |
| `messages` | İletişim mesajları (kişisel veri — dikkatli atanmalı) |
| `system` | Şablonlar, yasal metinler (L5 sekmeleri hariç) |
| `audit` | Audit log okuma (yalnızca `read`) |

### 4.2 Matris

| Yetenek | SUPER_ADMIN | EDITOR (varsayılan atama yok) |
|---|---|---|
| Dashboard görüntüleme | ✓ | `dashboard:read` atanırsa |
| İçerik modülleri (settings, hero, media, projects, categories, links) | ✓ | Atanan modüller |
| Durumlar: aç/kapa, config, test | ✓ | `status:write` atanırsa |
| Durumlar: secret girme, Spotify bağlama | ✓ | ✗ |
| İletişim mesajları | ✓ | `messages:*` atanırsa |
| Şablonlar, yasal metinler | ✓ | `system:write` atanırsa |
| SMTP yapılandırması | ✓ | ✗ (durumu görür) |
| Audit okuma | ✓ | `audit:read` atanırsa |
| Audit export | ✓ | ✗ |
| Yönetici yönetimi | ✓ | ✗ |
| Sistem işleri, Tech Stack yayını, Özellikler | ✓ | ✗ |
| Kendi hesabı (profil, e-posta, şifre, 2FA, oturumlar) | ✓ | ✓ |

### 4.3 Atama mekanizması

1. SUPER_ADMIN, Sistem > Yöneticiler'de "Yönetici ekle" der: e-posta, görünen ad, rol.
2. Rol EDITOR ise **modül yetkileri** paneli açılır: her modül için üç durumlu seçim — `Yok` / `Görüntüle` (`read`) / `Yönet` (`write`). Hazır profiller (kısayol): **İçerik Editörü** (`media, projects, categories, links, hero: write`), **Moderatör** (`messages: write`, `dashboard: read`).
3. Kayıtta `AdminUser.permissions` dizisi normalize edilerek saklanır (yalnızca en yüksek eylem: `["links:write", "dashboard:read"]`). Geçersiz anahtar → `422`.
4. Değişiklik anında hedefin oturumları sonlanır; audit: `ADMIN_PERMISSIONS_CHANGED` (`before`, `after` anahtar listeleri — değer değil, yetki adı olduğu için güvenli).
5. JWT `perms` claim'i bu diziyi taşır; `requirePermission` önce claim'e, sonra oturum canlılık kontrolüne güvenir. Yetki değişince oturum zaten iptal olduğundan eski claim kullanılamaz.

### 4.4 Uygulama (backend)

```js
// middleware/requirePermission.js
export const requirePermission = (perm) => (req, _res, next) => {
  const { role, permissions } = req.admin;
  if (role === 'SUPER_ADMIN') return next();
  const [mod, action] = perm.split(':');
  const ok = permissions.includes(perm) || (action === 'read' && permissions.includes(`${mod}:write`));
  return ok ? next() : next(new ForbiddenError());
};
```

İzin sabitleri `packages/shared/src/constants/permissions.js` içinde tek yerde tanımlıdır; frontend sidebar filtresi ve backend middleware aynı listeyi kullanır.

---

## 5. Admin UX kuralları

- **Skeleton, spinner değil:** Sayfa ilk yüklemesi her zaman içerik şekilli skeleton (Şartname §15.1). Spinner yalnızca buton içi işlem göstergesi.
- **İyimser güncelleme:** Aktif/pasif anahtarları ve sıralama iyimser (optimistic) güncellenir; hata olursa geri alınır ve toast gösterilir.
- **Toast metinleri:** Başarı: "{Kayıt} kaydedildi." · Hata: sunucunun `message` alanı + gerekiyorsa "Tekrar dene" eylemi.
- **Boş durumlar:** Her liste ekranı için açıklama + birincil eylem ("Henüz link yok. İlk linkini ekle.").
- **Tehlikeli eylemler:** Kırmızı (`destructive`) buton yalnızca onay diyaloğunda; liste satırında ikon + menü içinde.
- **Klavye:** Tüm tablolar ve sıralanabilir listeler klavye ile kullanılabilir; form gönderimi `Ctrl/⌘ Enter`.
- **Oturum süresi:** Access token yenilemesi arka planda; refresh başarısızsa form verisi kaybolmasın diye "Oturumun sona erdi" diyaloğu → yeniden giriş sonrası aynı sayfaya dönüş (`next` parametresi), taslak `sessionStorage`'da korunur.
