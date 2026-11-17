# DATABASE — Veri Modeli

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · **DB:** PostgreSQL 17 · **ORM:** Prisma (JS istemcisi)
> Diyagram: ERD.md. Bu dosyadaki şema, `backend/prisma/schema.prisma` için **referans tanımdır**; ikisi ayrışırsa bu dosya güncellenmeden şema değiştirilmez.

---

## 1. Genel kurallar

1. **Tablo adları:** Prisma modeli PascalCase tekil (`Project`), DB tablosu `@@map` ile snake_case çoğul (`projects`). Sütunlar `@map` ile snake_case.
2. **Primary key stratejisi:**
   - Güvenlik/kimlik tabloları (`AdminUser`, `AdminSession`, `MediaAsset`, `ContactMessage`): `UUID v4` (`@db.Uuid`, `gen_random_uuid()`).
   - İçerik tabloları (`ProfileMedia`, `Background`, `Music`, `CursorSet`, `Project`, `Category`, `LinkItem`): `Int autoincrement` — Şartname §10 "ID sırasına göre artan" listeleme bu ID'ye dayanır. Dışarıya açılan tanımlayıcı gerektiğinde `publicId` (`cuid`) kullanılır; sıralı ID URL'de ifşa edilmez.
   - Yüksek hacimli olay tabloları (`AuditLog`, `DownloadEvent`, `AnalyticsEvent`): `BigInt autoincrement`.
   - Tekil ayar tabloları (`SiteSettings`, `HeroSettings`, `AboutContent`, `MailSettings`): `Int @id @default(1)` + `CHECK (id = 1)`.
3. **Zaman damgaları:** `createdAt @default(now())`, `updatedAt @updatedAt`; tip `timestamptz(3)`. Takvim günü gereken yerde `@db.Date`.
4. **Başlıklar benzersiz değildir** (Şartname §21.1). Yalnızca `Category.nameKey`, `Project.slug`, `AdminUser.email` benzersizdir.
5. **Durum bayrakları bağımsızdır:** `isActive` ve `isDownloadable` ayrı sütunlardır (Şartname §21.2).
6. **Dosya içeriği DB'de tutulmaz;** yalnızca `storageKey`, MIME, boyut, hash ve metadata.
7. **Şifreli alanlar** `...Enc` sonekiyle adlandırılır ve `v1:<iv>:<tag>:<ciphertext>` (base64url) biçiminde AES-256-GCM metni tutar.
8. **Hash'li alanlar** `...Hash` sonekiyle adlandırılır.
9. **Para/hassas sayı yok;** boyutlar byte olarak `Int` (≤ 2 GB) tutulur.
10. Prisma'nın ifade edemediği kısıtlar (CHECK, kısmi index, ifade index'i) **raw SQL migration** dosyasıyla eklenir ve §6'da listelenir.

---

## 2. Enum'lar

| Enum | Değerler | Kullanım |
|---|---|---|
| `AdminRole` | `SUPER_ADMIN`, `EDITOR` | ADMIN.md |
| `MediaKind` | `BACKGROUND`, `MUSIC_AUDIO`, `MUSIC_COVER`, `PROFILE`, `CURSOR`, `PROJECT_IMAGE`, `LINK_IMAGE`, `FAVICON`, `TECH_STACK_IMAGE`, `NAME_OVERLAY`, `FALLING_IMAGE` | Yükleme kuralları (SRS FR-MED-03) |
| `MediaType` | `IMAGE`, `ANIMATED_IMAGE`, `VIDEO`, `AUDIO`, `CURSOR` | Render kararı (loop vb.) |
| `ProcessingStatus` | `PENDING`, `PROCESSING`, `READY`, `FAILED` | Medya iş kuyruğu |
| `RotationCategory` | `BACKGROUND`, `MUSIC`, `PFP`, `CURSOR`, `NAME_OVERLAY` | Rotasyon |
| `NameEffect` | `NEON`, `GRADIENT`, `GRADIENT_ANIMATED`, `OVERLAY` | Hero (PARTICLES/STARS 2026-11-16 kaldırıldı) |
| `FallingKind` | `IMAGE`, `TEXT` | Yağan öğeler |
| `ProfileMode` | `ROTATION`, `FIXED` | Hero profil görseli kaynağı |
| `IntegrationProvider` | `DISCORD`, `SPOTIFY`, `GITHUB` | |
| `IntegrationStatus` | `DISCONNECTED`, `CONNECTED`, `ERROR` | |
| `ContactStatus` | `PENDING`, `REPLIED` | |
| `DownloadTarget` | `WALLPAPER`, `PFP` | `WALLPAPER` = duvar kağıdı işaretli `Background` |
| `AnalyticsEventType` | `PAGE_VIEW`, `PROJECT_VIEW` | |
| `TemplateChannel` | `EMAIL`, `WHATSAPP` | CMS.md §5–6. `WHATSAPP` kullanılmıyor (CMS.md §6); migration ile kaldırılacak |
| `TemplateKey` | `PASSWORD_RESET`, `CONTACT_NOTIFICATION`, `SMTP_TEST`, `CONTACT_REPLY_EMAIL`, `CONTACT_REPLY_WHATSAPP` | `CONTACT_REPLY_WHATSAPP` kullanılmıyor; migration ile kaldırılacak |
| `LegalDocKey` | `KVKK_NOTICE`, `COOKIE_POLICY` | |

---

## 3. Referans Prisma şeması

> **Prisma 7 uygulama notları (F2'de doğrulandı, 2026-11-14):**
> - Sürüm `prisma` / `@prisma/client` **7.10.1** (npm `latest` etiketi 8.0 RC gösterdiği için kararlı 7.x sabitlendi).
> - Generator `prisma-client-js` Prisma 7'de çalışıyor; istemci `node_modules/@prisma/client` altına JS olarak üretilir. TypeScript üreten `prisma-client` generator'ı **kullanılmaz** (RULES.md §1).
> - Prisma 7'de bağlantı adresi şemada değil, `backend/prisma.config.mjs` içindedir (`datasource.url`). Config, `.env` dosyasını Node'un `process.loadEnvFile` fonksiyonuyla okur; `DATABASE_URL` yoksa datasource eklemez ki temiz kurulumda `postinstall` → `prisma generate` kırılmasın.
> - İstemci driver adapter ile kurulur: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` (`backend/src/lib/prisma.js`).
> - Aşağıdaki blok okunabilirlik için sütun `@map`'lerini göstermez. Gerçek `schema.prisma`'da camelCase her alan `@map("snake_case")` taşır (§1 kural 1); §6 SQL'i bu adları kullanır.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  // url → prisma.config.mjs (Prisma 7)
}

// ───────────────────────────── Enum'lar ─────────────────────────────
enum AdminRole          { SUPER_ADMIN EDITOR }
enum MediaKind          { BACKGROUND MUSIC_AUDIO MUSIC_COVER PROFILE CURSOR PROJECT_IMAGE LINK_IMAGE FAVICON }
enum MediaType          { IMAGE ANIMATED_IMAGE VIDEO AUDIO CURSOR }
enum ProcessingStatus   { PENDING PROCESSING READY FAILED }
enum RotationCategory   { BACKGROUND MUSIC PFP CURSOR }
enum NameEffect         { NEON GRADIENT PARTICLES STARS }
enum ProfileMode        { ROTATION FIXED }
enum IntegrationProvider{ DISCORD SPOTIFY GITHUB }
enum IntegrationStatus  { DISCONNECTED CONNECTED ERROR }
enum ContactStatus      { PENDING REPLIED }
enum DownloadTarget     { WALLPAPER PFP }
enum AnalyticsEventType { PAGE_VIEW PROJECT_VIEW }
enum TemplateChannel    { EMAIL WHATSAPP }
enum TemplateKey        { PASSWORD_RESET CONTACT_NOTIFICATION SMTP_TEST CONTACT_REPLY_EMAIL CONTACT_REPLY_WHATSAPP }
enum LegalDocKey        { KVKK_NOTICE COOKIE_POLICY }

// ───────────────────────────── Kimlik & Oturum ─────────────────────────────
model AdminUser {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email                String    @unique                 // küçük harfe normalize
  displayName          String?   @db.VarChar(80)
  passwordHash         String                            // argon2id PHC string
  role                 AdminRole @default(SUPER_ADMIN)
  permissions          String[]  @default([])            // EDITOR modül kapsamları (ADMIN.md §4)
  isActive             Boolean   @default(true)
  mustChangePassword   Boolean   @default(false)
  passwordChangedAt    DateTime? @db.Timestamptz(3)
  totpEnabled          Boolean   @default(false)
  totpSecretEnc        String?                           // aktif TOTP secret (şifreli)
  totpPendingSecretEnc String?                           // kurulum sürerken geçici secret
  lastTotpStep         BigInt?                           // replay koruması
  failedLoginCount     Int       @default(0)
  lockedUntil          DateTime? @db.Timestamptz(3)
  lastLoginAt          DateTime? @db.Timestamptz(3)
  createdAt            DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime  @updatedAt @db.Timestamptz(3)

  sessions        AdminSession[]
  resetTokens     PasswordResetToken[]
  recoveryCodes   RecoveryCode[]
  auditLogs       AuditLog[]
  uploadedAssets  MediaAsset[]       @relation("UploadedBy")
  overrides       ContentOverride[]

  @@map("admin_users")
}

model AdminSession {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminId          String    @db.Uuid
  familyId         String    @db.Uuid                    // rotasyon zinciri
  refreshTokenHash String    @unique                     // sha256(token) hex
  rememberMe       Boolean   @default(false)
  expiresAt        DateTime  @db.Timestamptz(3)
  lastUsedAt       DateTime  @default(now()) @db.Timestamptz(3)
  rotatedAt        DateTime? @db.Timestamptz(3)          // yenisiyle değiştirildi
  revokedAt        DateTime? @db.Timestamptz(3)
  revokedReason    String?   @db.VarChar(40)             // LOGOUT | ADMIN_REVOKE | REUSE | PASSWORD_CHANGE | EXPIRED
  ipAddress        String?   @db.VarChar(45)
  userAgent        String?   @db.VarChar(400)
  createdAt        DateTime  @default(now()) @db.Timestamptz(3)

  admin AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
  @@index([familyId])
  @@index([expiresAt])
  @@map("admin_sessions")
}

model PasswordResetToken {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminId       String    @db.Uuid
  tokenHash     String    @unique
  expiresAt     DateTime  @db.Timestamptz(3)
  usedAt        DateTime? @db.Timestamptz(3)
  requestIpHash String?   @db.VarChar(64)
  createdAt     DateTime  @default(now()) @db.Timestamptz(3)

  admin AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@index([adminId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}

model RecoveryCode {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  adminId   String    @db.Uuid
  codeHash  String                                       // sha256(normalize(code))
  usedAt    DateTime? @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @db.Timestamptz(3)

  admin AdminUser @relation(fields: [adminId], references: [id], onDelete: Cascade)

  @@unique([adminId, codeHash])
  @@map("recovery_codes")
}

model MailSettings {
  id              Int       @id @default(1)
  smtpHost        String?   @db.VarChar(255)
  smtpPort        Int?
  smtpSecure      Boolean   @default(true)
  smtpUser        String?   @db.VarChar(255)
  appPasswordEnc  String?                                // mail uygulama anahtarı (şifreli)
  fromName        String?   @db.VarChar(80)
  fromEmail       String?   @db.VarChar(254)
  notifyOnContact Boolean   @default(false)
  notifyEmail     String?   @db.VarChar(254)
  lastTestAt      DateTime? @db.Timestamptz(3)
  lastTestOk      Boolean?
  updatedAt       DateTime  @updatedAt @db.Timestamptz(3)

  @@map("mail_settings")
}

// ───────────────────────────── Site içeriği (tekil) ─────────────────────────────
model SiteSettings {
  id                 Int       @id @default(1)
  navbarTitle        String    @default("1uc44s GitHub") @db.VarChar(40)
  faviconAssetId     String?   @db.Uuid
  footerTechs        Json      @default("[]")           // [{ "label": "React", "icon": "SiReact" }]
  techStackPublished Boolean   @default(false)          // en son faz; o zamana kadar false
  techStackTitleTop    String  @default("7")     @db.VarChar(20)  // F21 merkez başlık 1. satır
  techStackTitleMain   String  @default("Tech")  @db.VarChar(40)  // 2. satır (eğik çizgi üzerinde)
  techStackTitleBottom String  @default("Stack") @db.VarChar(40)  // 3. satır (taranmış)
  updatedAt          DateTime  @updatedAt @db.Timestamptz(3)

  favicon MediaAsset? @relation("Favicon", fields: [faviconAssetId], references: [id], onDelete: SetNull)

  @@map("site_settings")
}

model HeroSettings {
  id                  Int          @id @default(1)
  displayName         String       @default("") @db.VarChar(60)
  tagline             String?      @db.VarChar(160)
  location            String?      @db.VarChar(80)
  nameEffects         NameEffect[] @default([])
  profileMode         ProfileMode  @default(ROTATION)
  fixedProfileMediaId Int?
  updatedAt           DateTime     @updatedAt @db.Timestamptz(3)

  fixedProfileMedia ProfileMedia? @relation("HeroFixedProfile", fields: [fixedProfileMediaId], references: [id], onDelete: SetNull)

  @@map("hero_settings")
}

model AboutContent {
  id           Int      @id @default(1)
  title        String   @default("Hakkımda") @db.VarChar(80)
  bodyMarkdown String   @default("") @db.Text            // ≤ 20 000 karakter (uygulama)
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)

  @@map("about_content")
}

model LegalDocument {
  id           Int         @id @default(autoincrement())
  key          LegalDocKey @unique
  title        String      @db.VarChar(120)
  bodyMarkdown String      @db.Text
  version      Int         @default(1)                   // COOKIE_POLICY sürümü banner'ı tetikler
  updatedAt    DateTime    @updatedAt @db.Timestamptz(3)

  @@map("legal_documents")
}

model MessageTemplate {
  id        Int             @id @default(autoincrement())
  key       TemplateKey     @unique
  channel   TemplateChannel
  subject   String?         @db.VarChar(200)            // EMAIL için
  body      String          @db.Text
  isSystem  Boolean         @default(true)              // silinemez, varsayılana sıfırlanabilir
  updatedAt DateTime        @updatedAt @db.Timestamptz(3)

  @@map("message_templates")
}

// ───────────────────────────── Medya ─────────────────────────────
model MediaAsset {
  id               String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  kind             MediaKind
  mediaType        MediaType
  storageKey       String           @unique              // ör. bg/2b1e...c9.webp
  posterKey        String?                               // video poster (webp)
  thumbnailKey     String?                               // küçük önizleme (webp)
  downloadKey      String?                               // indirme için ayrı varyant (BACKGROUND görseli; duvar kağıdı indirmesi)
  originalFilename String           @db.VarChar(255)    // yalnızca gösterim
  safeFilename     String           @db.VarChar(100)    // indirme adı (slug)
  mimeType         String           @db.VarChar(100)
  extension        String           @db.VarChar(10)
  sizeBytes        Int
  totalBytes       Int              @default(0)          // tüm varyantların toplamı (depolama özeti)
  sha256           String           @db.Char(64)
  width            Int?
  height           Int?
  durationMs       Int?
  processingStatus ProcessingStatus @default(PENDING)
  processingError  String?          @db.VarChar(500)
  metadata         Json?                                 // codec, bitrate vb. (kişisel veri yok); video: sourceKey (tmp/queue/<id>.mp4) READY'ye kadar
  uploadedById     String?          @db.Uuid
  createdAt        DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime         @updatedAt @db.Timestamptz(3)

  // Sahip tablolardaki FK'ler @unique olduğu için ilişkiler 1:1'dir (ters taraf tekil ve opsiyonel).
  uploadedBy    AdminUser?     @relation("UploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)
  background    Background?
  musicAudio    Music?         @relation("MusicAudio")
  musicCover    Music?         @relation("MusicCover")
  profileMedia  ProfileMedia?
  cursorNormal  CursorSet?     @relation("CursorNormal")
  cursorClick   CursorSet?     @relation("CursorClick")
  projectImage  ProjectImage?
  linkItem      LinkItem?
  faviconOf     SiteSettings[] @relation("Favicon")

  @@index([kind, createdAt(sort: Desc)])
  @@index([sha256])
  @@index([processingStatus])
  @@map("media_assets")
}

model StorageDeletionJob {
  id          BigInt    @id @default(autoincrement())
  storageKey  String
  attempts    Int       @default(0)
  lastError   String?   @db.VarChar(500)
  nextRunAt   DateTime  @default(now()) @db.Timestamptz(3)
  processedAt DateTime? @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)

  @@index([processedAt, nextRunAt])
  @@map("storage_deletion_jobs")
}

// ───────────────────────────── Rotasyon içerikleri ─────────────────────────────
model Background {
  id              Int      @id @default(autoincrement())
  publicId        String   @unique @default(cuid())
  title           String   @db.VarChar(120)
  assetId         String   @unique @db.Uuid
  isActive        Boolean  @default(true)
  rotationEnabled Boolean  @default(true)
  isWallpaper     Boolean  @default(false) // true: /wallpapers'ta listelenir ve indirilir
  downloadCount   Int      @default(0)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)

  asset      MediaAsset              @relation(fields: [assetId], references: [id], onDelete: Restrict)
  selections DailyContentSelection[]
  overrides  ContentOverride[]

  @@index([isActive, rotationEnabled])
  @@map("backgrounds")
}

model Music {
  id              Int      @id @default(autoincrement())
  publicId        String   @unique @default(cuid())
  title           String   @db.VarChar(120)
  artist          String?  @db.VarChar(120)
  audioAssetId    String   @unique @db.Uuid
  coverAssetId    String   @unique @db.Uuid            // kapak zorunlu (Şartname §12.2)
  durationMs      Int?
  isActive        Boolean  @default(true)
  rotationEnabled Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)

  audio      MediaAsset              @relation("MusicAudio", fields: [audioAssetId], references: [id], onDelete: Restrict)
  cover      MediaAsset              @relation("MusicCover", fields: [coverAssetId], references: [id], onDelete: Restrict)
  selections DailyContentSelection[]
  overrides  ContentOverride[]

  @@index([isActive, rotationEnabled])
  @@map("musics")
}

model ProfileMedia {
  id              Int      @id @default(autoincrement())
  publicId        String   @unique @default(cuid())
  title           String   @db.VarChar(120)
  assetId         String   @unique @db.Uuid
  isActive        Boolean  @default(true)
  isDownloadable  Boolean  @default(false)
  rotationEnabled Boolean  @default(true)              // hero rotasyon havuzunda mı
  downloadCount   Int      @default(0)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)

  asset          MediaAsset              @relation(fields: [assetId], references: [id], onDelete: Restrict)
  selections     DailyContentSelection[]
  overrides      ContentOverride[]
  downloads      DownloadEvent[]
  heroFixedOf    HeroSettings[]          @relation("HeroFixedProfile")

  @@index([isActive, isDownloadable, id])
  @@index([isActive, rotationEnabled])
  @@map("profile_media")
}

model CursorSet {
  id              Int      @id @default(autoincrement())
  publicId        String   @unique @default(cuid())
  title           String   @db.VarChar(120)
  normalAssetId   String   @unique @db.Uuid
  clickAssetId    String   @unique @db.Uuid
  normalHotspotX  Int      @default(0)
  normalHotspotY  Int      @default(0)
  clickHotspotX   Int      @default(0)
  clickHotspotY   Int      @default(0)
  isActive        Boolean  @default(true)
  rotationEnabled Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)

  normal     MediaAsset              @relation("CursorNormal", fields: [normalAssetId], references: [id], onDelete: Restrict)
  click      MediaAsset              @relation("CursorClick", fields: [clickAssetId], references: [id], onDelete: Restrict)
  selections DailyContentSelection[]
  overrides  ContentOverride[]

  @@index([isActive, rotationEnabled])
  @@map("cursor_sets")
}

> 2026-11-16: Ayrı `Wallpaper` tablosu kaldırıldı. Duvar kağıdı = `Background.isWallpaper = true` (aktif + READY) olan arka plan; `/wallpapers` bunları listeler ve indirir. Migration `20261116010000_wallpaper_flag_on_backgrounds`.

model DailyContentSelection {
  id             Int              @id @default(autoincrement())
  category       RotationCategory
  selectedDate   DateTime         @db.Date               // Europe/Istanbul takvim günü
  cycleNumber    Int
  backgroundId   Int?
  musicId        Int?
  profileMediaId Int?
  cursorSetId    Int?
  createdAt      DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime         @updatedAt @db.Timestamptz(3)

  background   Background?   @relation(fields: [backgroundId], references: [id], onDelete: SetNull)
  music        Music?        @relation(fields: [musicId], references: [id], onDelete: SetNull)
  profileMedia ProfileMedia? @relation(fields: [profileMediaId], references: [id], onDelete: SetNull)
  cursorSet    CursorSet?    @relation(fields: [cursorSetId], references: [id], onDelete: SetNull)

  @@unique([category, selectedDate])
  @@index([category, cycleNumber])
  @@map("daily_content_selections")
}

model ContentOverride {
  id             Int              @id @default(autoincrement())
  category       RotationCategory @unique                // kategori başına en fazla 1
  backgroundId   Int?
  musicId        Int?
  profileMediaId Int?
  cursorSetId    Int?
  validUntil     DateTime         @db.Timestamptz(3)      // bir sonraki 00:00 Europe/Istanbul
  createdById    String?          @db.Uuid
  createdAt      DateTime         @default(now()) @db.Timestamptz(3)

  background   Background?   @relation(fields: [backgroundId], references: [id], onDelete: Cascade)
  music        Music?        @relation(fields: [musicId], references: [id], onDelete: Cascade)
  profileMedia ProfileMedia? @relation(fields: [profileMediaId], references: [id], onDelete: Cascade)
  cursorSet    CursorSet?    @relation(fields: [cursorSetId], references: [id], onDelete: Cascade)
  createdBy    AdminUser?    @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@map("content_overrides")
}

// ───────────────────────────── Projeler ─────────────────────────────
model Category {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(60)
  nameKey   String   @unique @db.VarChar(60)            // normalizeKey(name) — §4.1
  isActive  Boolean  @default(true)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  projects ProjectCategory[]

  @@index([isActive, sortOrder])
  @@map("categories")
}

model Project {
  id          Int       @id @default(autoincrement())
  slug        String    @unique @db.VarChar(120)
  title       String    @db.VarChar(120)
  description String    @db.Text                       // Markdown, ≤ 20 000
  demoUrl     String?   @db.VarChar(2048)
  videoUrl    String?   @db.VarChar(2048)
  githubUrl   String?   @db.VarChar(2048)
  isPublished Boolean   @default(false)
  sortOrder   Int       @default(0)
  viewCount   Int       @default(0)
  publishedAt DateTime? @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime  @updatedAt @db.Timestamptz(3)

  categories      ProjectCategory[]
  images          ProjectImage[]
  analyticsEvents AnalyticsEvent[]

  @@index([isPublished, sortOrder, id])
  @@map("projects")
}

model ProjectCategory {
  projectId  Int
  categoryId Int
  assignedAt DateTime @default(now()) @db.Timestamptz(3)

  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@id([projectId, categoryId])
  @@index([categoryId])
  @@map("project_categories")
}

model ProjectImage {
  id        Int      @id @default(autoincrement())
  projectId Int
  assetId   String   @unique @db.Uuid
  alt       String?  @db.VarChar(160)
  sortOrder Int      @default(0)                        // 0 = kapak
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  project Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  asset   MediaAsset @relation(fields: [assetId], references: [id], onDelete: Restrict)

  @@index([projectId, sortOrder])
  @@map("project_images")
}

// ───────────────────────────── Linkler ─────────────────────────────
model LinkItem {
  id           Int      @id @default(autoincrement())
  title        String   @db.VarChar(80)                // benzersiz DEĞİL
  url          String   @db.VarChar(2048)
  imageAssetId String   @unique @db.Uuid
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)

  image MediaAsset @relation(fields: [imageAssetId], references: [id], onDelete: Restrict)

  @@index([isActive, sortOrder, id])
  @@map("link_items")
}

// ───────────────────────────── Entegrasyonlar ─────────────────────────────
model IntegrationSetting {
  id             Int                 @id @default(autoincrement())
  provider       IntegrationProvider @unique
  isEnabled      Boolean             @default(false)
  config         Json                @default("{}")    // gizli olmayan: discordUserId, githubUsername, spotifyClientId
  secretsEnc     String?                               // JSON → AES-GCM: botToken, clientSecret, refreshToken
  status         IntegrationStatus   @default(DISCONNECTED)
  lastSyncAt     DateTime?           @db.Timestamptz(3)
  lastSuccessAt  DateTime?           @db.Timestamptz(3)
  lastError      String?             @db.VarChar(500)  // secret içermez
  publicSnapshot Json?                                 // yalnızca public alanlar
  snapshotAt     DateTime?           @db.Timestamptz(3)
  updatedAt      DateTime            @updatedAt @db.Timestamptz(3)

  @@map("integration_settings")
}

// ───────────────────────────── Tech Stack (F21) ─────────────────────────────
model TechStackItem {
  id           Int      @id @default(autoincrement())
  label        String   @db.VarChar(40)           // ör. "React", "Rest API / AXIOS"
  description  String   @default("") @db.Text     // ≤ 2000, düz metin (satır sonları korunur)
  imageAssetId String?  @unique @db.Uuid          // TECH_STACK_IMAGE (daire içi çizim); yoksa baş harf
  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)               // numara rozeti = sıra + 1
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @db.Timestamptz(3)
  // en fazla 9 öğe (uygulama); MediaKind'e TECH_STACK_IMAGE eklenir (png/jpg/webp/gif, ≤ 5 MB)
}

// ───────────────────────────── İletişim ─────────────────────────────
model ContactMessage {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  firstName      String        @db.VarChar(60)
  lastName       String        @db.VarChar(60)
  phone          String?       @db.VarChar(20)          // E.164 normalize; opsiyonel (2026-11-15)
  email          String        @db.VarChar(254)
  subject        String        @db.VarChar(120)
  message        String        @db.Text
  isRead         Boolean       @default(false)
  readAt         DateTime?     @db.Timestamptz(3)
  status         ContactStatus @default(PENDING)
  repliedAt      DateTime?     @db.Timestamptz(3)
  isSpam         Boolean       @default(false)
  ipHash         String?       @db.VarChar(64)          // HMAC(dailySalt, ip) — ham IP yok
  userAgent      String?       @db.VarChar(400)
  retentionUntil DateTime      @db.Timestamptz(3)       // createdAt + 12 ay
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)

  @@index([isSpam, isRead, createdAt(sort: Desc)])
  @@index([status])
  @@index([retentionUntil])
  @@map("contact_messages")
}

// ───────────────────────────── Olaylar & Log ─────────────────────────────
model DownloadEvent {
  id             BigInt         @id @default(autoincrement())
  target         DownloadTarget
  backgroundId   Int?
  profileMediaId Int?
  visitorHash    String?        @db.VarChar(64)         // 90 gün sonra NULL
  counted        Boolean
  createdAt      DateTime       @default(now()) @db.Timestamptz(3)

  background   Background?   @relation(fields: [backgroundId], references: [id], onDelete: SetNull)
  profileMedia ProfileMedia? @relation(fields: [profileMediaId], references: [id], onDelete: SetNull)

  @@index([backgroundId, visitorHash, createdAt])
  @@index([profileMediaId, visitorHash, createdAt])
  @@index([createdAt])
  @@map("download_events")
}

model AnalyticsEvent {
  id          BigInt             @id @default(autoincrement())
  type        AnalyticsEventType
  path        String             @db.VarChar(200)
  projectId   Int?
  visitorHash String             @db.VarChar(64)
  day         DateTime           @db.Date              // Europe/Istanbul günü
  createdAt   DateTime           @default(now()) @db.Timestamptz(3)

  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([type, day])
  @@index([day, visitorHash])
  @@index([projectId, day])
  @@map("analytics_events")
}

model CookieConsentRecord {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid  // istemcideki consentId
  version   Int
  analytics Boolean
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@map("cookie_consent_records")
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  adminId    String?  @db.Uuid
  action     String   @db.VarChar(60)
  entityType String?  @db.VarChar(40)
  entityId   String?  @db.VarChar(64)
  metadata   Json?                                       // redaction'dan geçmiş
  ipAddress  String?  @db.VarChar(45)
  userAgent  String?  @db.VarChar(400)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)

  admin AdminUser? @relation(fields: [adminId], references: [id], onDelete: SetNull)

  @@index([createdAt(sort: Desc)])
  @@index([adminId, createdAt(sort: Desc)])
  @@index([entityType, entityId])
  @@index([action, createdAt(sort: Desc)])
  @@map("audit_logs")
}

model SystemState {
  key       String   @id @db.VarChar(60)                // ör. "daily_salt", "rotation_last_run"
  value     Json
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  @@map("system_state")
}
```

---

### 3.x 2026-11-16 eklemeleri (özet)

- `HeroSettings.gradientFrom` / `gradientTo` — `VarChar(7)`, varsayılan `#a78bfa` / `#f472b6`.
- `NameOverlay` (`name_overlays`): `id`, `publicId`, `title`, `assetId` (unique, Restrict), `isActive`, `rotationEnabled`, `sortOrder`, zaman damgaları. `DailyContentSelection.nameOverlayId` ve `ContentOverride.nameOverlayId` (SetNull); kategori CHECK kısıtları `NAME_OVERLAY` ile genişletildi.
- Discord manuel banner (`IntegrationSetting.bannerAssetId`, MediaKind `DISCORD_BANNER`) eklendi ve aynı gün kaldırıldı (migration `drop_discord_manual_banner`).
- `FallingItem` (`falling_items`): `id`, `kind FallingKind`, `text VarChar(16)?`, `imageAssetId` (unique, Restrict, nullable), `size Int` (12–64, CHECK), `isActive`, `sortOrder`, zaman damgaları. CHECK: `IMAGE` → görsel dolu + metin boş; `TEXT` → metin dolu + görsel boş.

## 4. Alan kuralları ve türetilmiş değerler

### 4.1 Kategori benzersizliği (case-insensitive, Türkçe uyumlu)

```js
// packages/shared/text/normalizeKey.js
export const normalizeKey = (s) =>
  s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
```

`nameKey` her yazımda servis katmanında `normalizeKey(name)` ile üretilir; `UNIQUE` index çakışmayı (P2002) yakalar → `409 CONFLICT "Bu kategori zaten var."`. `citext` yerine bu yöntem seçildi çünkü `citext` Türkçe `İ/ı` eşlemesini doğru yapmaz.

### 4.2 Slug

- `slugify(title, { locale: 'tr', lower: true, strict: true })`, ≤ 120 karakter.
- Çakışmada `-2`, `-3` … soneki. Admin manuel slug girerse aynı kural ve regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`.

### 4.3 Proje linki kuralı

`demoUrl`, `videoUrl`, `githubUrl`'den en az biri dolu (Zod `superRefine` + DB CHECK, §6).

### 4.4 Rotasyon seçimi tutarlılığı

`DailyContentSelection` ve `ContentOverride` satırlarında `category` değerine karşılık gelen FK sütunu dolu olabilir, **diğer üçü NULL olmak zorundadır** (DB CHECK, §6). Seçim satırındaki FK, içerik silinirse `SetNull` olur (geçmiş döngü kaydı korunur; FR-ROT-05 bugünü yeniden seçer).

### 4.5 Singleton tohumları

Migration sonrası seed (`prisma/seed.mjs`), yalnızca **sistem** kayıtlarını oluşturur: `SiteSettings(1)`, `HeroSettings(1)`, `AboutContent(1)`, `MailSettings(1)`, üç `IntegrationSetting` (kapalı), `MessageTemplate` varsayılanları, `LegalDocument` taslakları. **Kategori, proje, link, medya tohumlanmaz** (Şartname §7.1). Admin hesabı tohumlanmaz (FR-SETUP).

---

## 5. Foreign key ve cascade kuralları

| Tablo.sütun | Referans | onDelete | Gerekçe |
|---|---|---|---|
| admin_sessions.admin_id | admin_users | **Cascade** | Hesap silinince oturumlar anlamsız |
| password_reset_tokens.admin_id | admin_users | **Cascade** | |
| recovery_codes.admin_id | admin_users | **Cascade** | |
| audit_logs.admin_id | admin_users | **SetNull** | Log kalıcıdır, aktör silinse de kayıt durur |
| media_assets.uploaded_by_id | admin_users | **SetNull** | |
| content_overrides.created_by_id | admin_users | **SetNull** | |
| site_settings.favicon_asset_id | media_assets | **SetNull** | Favicon silinirse varsayılan favicon |
| hero_settings.fixed_profile_media_id | profile_media | **SetNull** | Rotasyona/avatar fallback'ine düşer |
| backgrounds.asset_id, musics.audio/cover, profile_media.asset_id, cursor_sets.normal/click, project_images.asset_id, link_items.image_asset_id | media_assets | **Restrict** | Medya, sahibi silinmeden silinemez; silme servis katmanından (sahip → asset → dosya kuyruğu) |
| daily_content_selections.*_id | içerik tabloları | **SetNull** | Döngü geçmişi korunur |
| content_overrides.*_id | içerik tabloları | **Cascade** | Silinen içeriğin override'ı da kalkar |
| project_categories.project_id | projects | **Cascade** | Proje silinince ilişki satırları gider |
| project_categories.category_id | categories | **Restrict** | Kullanımdaki kategori silinemez (Şartname §7.1) — servis "yeniden kategorilendir ve sil" akışı sunar |
| project_images.project_id | projects | **Cascade** | Servis, silmeden önce asset id'lerini toplayıp dosyaları kuyruğa yazar |
| download_events.background_id / profile_media_id | backgrounds / profile_media | **SetNull** | İstatistik geçmişi korunur |
| analytics_events.project_id | projects | **SetNull** | |

### 5.1 "Kullanımdaki medya" kontrolü

`MediaAsset` silinmeden önce şu ilişkilerin **hepsi** boş olmalıdır: `background, musicAudio, musicCover, profileMedia, cursorNormal, cursorClick, projectImage, linkItem, faviconOf`. Her asset en fazla bir sahip kayda bağlıdır (1:1); favicon istisnadır. Normalde medya, sahibi kayıtla birlikte silinir (ör. Wallpaper sil → asset sil). Bağımsız "medya kütüphanesinden sil" yalnızca yetim (orphan) asset'ler için açıktır.

### 5.2 Silme akışları (servis katmanı, tek transaction)

| İşlem | Adımlar |
|---|---|
| ProfileMedia / Background / LinkItem sil | 1) kaydı sil 2) asset'i sil 3) `storageKey, posterKey, thumbnailKey, downloadKey` → `StorageDeletionJob` 4) bugünün seçimi ise `reselectToday` 5) audit |
| Music sil | ses + kapak asset'leri için aynı |
| CursorSet sil | normal + click asset'leri için aynı |
| Project sil | 1) `ProjectImage.assetId`'leri topla 2) projeyi sil (ProjectImage + ProjectCategory cascade) 3) asset'leri sil 4) dosya kuyruğu 5) audit |
| Category sil | `projects` boşsa sil; doluysa 409 `IN_USE` + `{ projectCount }`; istemci `POST /categories/:id/reassign-and-delete { targetCategoryId | null }` çağırabilir |
| AdminUser sil | Son aktif SUPER_ADMIN silinemez (ADMIN.md §2.3) |

---

## 6. Raw SQL migration ekleri

`prisma/migrations/<ts>_constraints/migration.sql` içinde:

```sql
-- Singleton'lar
ALTER TABLE site_settings  ADD CONSTRAINT site_settings_singleton  CHECK (id = 1);
ALTER TABLE hero_settings  ADD CONSTRAINT hero_settings_singleton  CHECK (id = 1);
ALTER TABLE about_content  ADD CONSTRAINT about_content_singleton  CHECK (id = 1);
ALTER TABLE mail_settings  ADD CONSTRAINT mail_settings_singleton  CHECK (id = 1);

-- Proje: en az bir link
ALTER TABLE projects ADD CONSTRAINT projects_at_least_one_link
  CHECK (demo_url IS NOT NULL OR video_url IS NOT NULL OR github_url IS NOT NULL);

-- URL protokolü (savunma derinliği; asıl kontrol Zod'da)
ALTER TABLE link_items ADD CONSTRAINT link_items_url_http CHECK (url ~* '^https?://');
ALTER TABLE projects   ADD CONSTRAINT projects_urls_http CHECK (
  (demo_url   IS NULL OR demo_url   ~* '^https?://') AND
  (video_url  IS NULL OR video_url  ~* '^https?://') AND
  (github_url IS NULL OR github_url ~* '^https?://')
);

-- Rotasyon: kategoriye uygun tek FK
ALTER TABLE daily_content_selections ADD CONSTRAINT dcs_category_fk CHECK (
  (category = 'BACKGROUND' AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'MUSIC'      AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'PFP'        AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'CURSOR'     AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL)
);
ALTER TABLE content_overrides ADD CONSTRAINT co_category_fk CHECK (
  (category = 'BACKGROUND' AND background_id   IS NOT NULL AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'MUSIC'      AND music_id        IS NOT NULL AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'PFP'        AND profile_media_id IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'CURSOR'     AND cursor_set_id   IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL)
);

-- Hero efektleri en fazla 4 (tekrarsızlık Zod şemasında garanti edilir)
ALTER TABLE hero_settings ADD CONSTRAINT hero_effects_max CHECK (cardinality(name_effects) <= 4);

-- Sayaçlar negatif olamaz
ALTER TABLE backgrounds   ADD CONSTRAINT backgrounds_dl_nonneg   CHECK (download_count >= 0); -- 2026-11-16 (wallpapers yerine)
ALTER TABLE profile_media ADD CONSTRAINT profile_media_dl_nonneg CHECK (download_count >= 0);
ALTER TABLE projects      ADD CONSTRAINT projects_views_nonneg   CHECK (view_count >= 0);

-- Kısmi index'ler (sık sorgular)
CREATE INDEX profile_media_public_idx ON profile_media (id) WHERE is_active AND is_downloadable;
CREATE INDEX admin_sessions_live_idx  ON admin_sessions (admin_id) WHERE revoked_at IS NULL AND rotated_at IS NULL;
CREATE INDEX contact_unread_idx       ON contact_messages (created_at DESC) WHERE NOT is_read AND NOT is_spam;
```

---

## 7. Index gerekçeleri (sorgu → index)

| Sorgu | Index |
|---|---|
| Navbar bayrağı: `EXISTS background WHERE active AND is_wallpaper` | `backgrounds (is_active, is_wallpaper, id)` |
| `/wallpapers` listesi `ORDER BY id` keyset sayfalama | `backgrounds (is_active, is_wallpaper, id)` |
| Rotasyon havuzu | `(isActive, rotationEnabled)` her içerik tablosunda |
| Döngü içinde kullanılanlar | `daily_content_selections (category, cycleNumber)` |
| Bugünkü seçim | `UNIQUE (category, selectedDate)` |
| Public projeler | `projects (isPublished, sortOrder, id)` |
| Kategoriye göre projeler | `project_categories (categoryId)` |
| Public linkler | `link_items (isActive, sortOrder, id)` |
| İndirme tekilleştirme (aynı gün aynı ziyaretçi) | `download_events (backgroundId, visitorHash, createdAt)` |
| Dashboard günlük ziyaretçi | `analytics_events (day, visitorHash)` |
| Audit listesi ve filtreleri | `audit_logs (createdAt DESC)`, `(adminId, createdAt)`, `(action, createdAt)` |
| Refresh token arama | `UNIQUE admin_sessions.refreshTokenHash` |
| Aktif oturum listesi | `admin_sessions_live_idx` |
| Saklama temizliği | `contact_messages (retentionUntil)`, `admin_sessions (expiresAt)` |
| Medya kütüphanesi sekmeleri | `media_assets (kind, createdAt DESC)` |

---

## 8. Transaction ve eşzamanlılık

- **Rotasyon:** `prisma.$transaction(async (tx) => { await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtext(${'rotation:' + category}))\`; ... })` — kilit transaction bitince otomatik bırakılır. İzolasyon: `ReadCommitted` + advisory lock yeterli; `UNIQUE (category, selectedDate)` son savunma hattıdır (P2002 → mevcut kaydı oku).
- **İndirme sayacı:** `DownloadEvent` insert + `UPDATE backgrounds SET download_count = download_count + 1` aynı transaction'da; atomik artırma (`{ increment: 1 }`).
- **Reorder:** `PATCH /reorder { ids }` tek transaction'da `sortOrder = index * 10` yazar.
- **Refresh rotasyonu:** `SELECT ... FOR UPDATE` eşdeğeri olarak `updateMany({ where: { id, rotatedAt: null, revokedAt: null } })` sonucu `count === 1` kontrolü (iyimser kilit). `0` ise reuse/yarış → aile iptali.

---

## 9. Yedekleme

- **DB:** Günlük `pg_dump -Fc` (03:30 Europe/Istanbul), 14 gün günlük + 8 hafta haftalık saklama; dump şifrelenir (age/GPG) ve sunucu dışına kopyalanır.
- **Medya:** Yerel depoda günlük `restic` (veya `rclone sync`) artımlı yedek; S3 kullanılıyorsa bucket versioning + lifecycle.
- **Geri yükleme testi:** Ayda bir staging'e geri yükleme (TODO.md'de kontrol maddesi).
- **Prova (F19-05):** `bash scripts/restore-rehearsal.sh [konteyner] [db] [kullanıcı]` — kaynak DB'ye yazmadan `pg_dump -Fc` → geçici `<db>_restore_check` → `pg_restore` → 32 tablonun satır sayısı + migration sayısı karşılaştırılır → geçici DB ve dump silinir. Prod'da aynı adımlar şifrelenmiş yedekle, ayda bir.
- DB ve medya yedekleri aynı zaman penceresinde alınır; `StorageDeletionJob` işlenmemiş kayıtları yedekle birlikte tutulur.

---

## 10. Migration politikası

- Geliştirme: `npm run db:migrate -w backend` (`prisma migrate dev`). Prod: yalnızca `npm run db:deploy -w backend` (`prisma migrate deploy`, CI/CD adımı).
- Mevcut migration'lar: `20261113221953_init` (şema), `20261113222008_constraints` (§6).
- Seed: `npm run db:seed -w backend` — idempotent, mevcut kaydı ezmez (`upsert` + boş `update`).
- **Test veritabanı:** Testler `DATABASE_URL`'den türetilen ve adı `_test` ile biten ayrı veritabanında çalışır (yerelde `portfolyo_db_test`; `TEST_DATABASE_URL` ile ezilebilir). Vitest `globalSetup` veritabanını yoksa oluşturur, `migrate deploy` + seed uygular. Testler içerik tablolarını çocuktan ebeveyne `deleteMany` ile boşaltır; `TRUNCATE ... CASCADE` kullanılmaz (FK zinciri tekil ayar satırlarını silerdi).
- Geliştirme Postgres'i Docker'da **5447** portundadır (5432 yerel kurulum, 5433+ diğer projelerle çakışıyordu).
- Yıkıcı değişiklik (sütun silme/yeniden adlandırma) iki aşamalı yapılır: genişlet → veriyi taşı → daralt.
- Her migration PR'ında bu doküman ve ERD.md aynı commit'te güncellenir.
