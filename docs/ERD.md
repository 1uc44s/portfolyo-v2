# ERD — Entity Relationship Diagram

> **Sürüm:** 1.0 · **Son güncelleme:** 2026-11-14 · Kaynak tanım: DATABASE.md §3
> Okunabilirlik için diyagram dört bölüme ayrıldı. Kardinalite: `||--o{` bire-çok, `||--o|` bire-sıfır/bir, `}o--o{` çoka-çok (ara tabloyla).

---

## 1. Kimlik, oturum ve denetim

```mermaid
erDiagram
    AdminUser ||--o{ AdminSession : "sahip (Cascade)"
    AdminUser ||--o{ PasswordResetToken : "talep eder (Cascade)"
    AdminUser ||--o{ RecoveryCode : "sahip (Cascade)"
    AdminUser |o--o{ AuditLog : "yapar (SetNull)"
    AdminUser |o--o{ MediaAsset : "yükler (SetNull)"
    AdminUser |o--o{ ContentOverride : "oluşturur (SetNull)"

    AdminUser {
        uuid id PK
        string email UK
        string passwordHash
        AdminRole role
        string_array permissions
        bool isActive
        bool mustChangePassword
        bool totpEnabled
        string totpSecretEnc
        bigint lastTotpStep
        int failedLoginCount
        timestamptz lockedUntil
        timestamptz lastLoginAt
    }
    AdminSession {
        uuid id PK
        uuid adminId FK
        uuid familyId
        string refreshTokenHash UK
        bool rememberMe
        timestamptz expiresAt
        timestamptz rotatedAt
        timestamptz revokedAt
        string revokedReason
        string ipAddress
        string userAgent
    }
    PasswordResetToken {
        uuid id PK
        uuid adminId FK
        string tokenHash UK
        timestamptz expiresAt
        timestamptz usedAt
    }
    RecoveryCode {
        uuid id PK
        uuid adminId FK
        string codeHash
        timestamptz usedAt
    }
    AuditLog {
        bigint id PK
        uuid adminId FK
        string action
        string entityType
        string entityId
        json metadata
        timestamptz createdAt
    }
    MailSettings {
        int id PK "=1"
        string smtpHost
        int smtpPort
        string smtpUser
        string appPasswordEnc
        string fromEmail
        bool notifyOnContact
    }
    SystemState {
        string key PK
        json value
    }
```

---

## 2. Medya ve günlük rotasyon

```mermaid
erDiagram
    MediaAsset ||--o| Background : "asset (Restrict)"
    MediaAsset ||--o| Music : "audio (Restrict)"
    MediaAsset ||--o| Music : "cover (Restrict)"
    MediaAsset ||--o| ProfileMedia : "asset (Restrict)"
    MediaAsset ||--o| CursorSet : "normal (Restrict)"
    MediaAsset ||--o| CursorSet : "click (Restrict)"
    MediaAsset |o--o{ SiteSettings : "favicon (SetNull)"

    Background |o--o{ DailyContentSelection : "seçildi (SetNull)"
    Music |o--o{ DailyContentSelection : "seçildi (SetNull)"
    ProfileMedia |o--o{ DailyContentSelection : "seçildi (SetNull)"
    CursorSet |o--o{ DailyContentSelection : "seçildi (SetNull)"

    Background |o--o| ContentOverride : "override (Cascade)"
    Music |o--o| ContentOverride : "override (Cascade)"
    ProfileMedia |o--o| ContentOverride : "override (Cascade)"
    CursorSet |o--o| ContentOverride : "override (Cascade)"

    ProfileMedia |o--o{ HeroSettings : "sabit profil (SetNull)"
    Background |o--o{ DownloadEvent : "duvar kağıdı indirildi (SetNull)"
    ProfileMedia |o--o{ DownloadEvent : "indirildi (SetNull)"

    MediaAsset {
        uuid id PK
        MediaKind kind
        MediaType mediaType
        string storageKey UK
        string posterKey
        string thumbnailKey
        string downloadKey
        string safeFilename
        string mimeType
        int sizeBytes
        char64 sha256
        int width
        int height
        int durationMs
        ProcessingStatus processingStatus
    }
    StorageDeletionJob {
        bigint id PK
        string storageKey
        int attempts
        timestamptz nextRunAt
        timestamptz processedAt
    }
    Background {
        int id PK
        string publicId UK
        string title
        uuid assetId FK,UK
        bool isActive
        bool rotationEnabled
        int sortOrder
    }
    Music {
        int id PK
        string publicId UK
        string title
        string artist
        uuid audioAssetId FK,UK
        uuid coverAssetId FK,UK
        int durationMs
        bool isActive
        bool rotationEnabled
    }
    ProfileMedia {
        int id PK
        string publicId UK
        string title
        uuid assetId FK,UK
        bool isActive
        bool isDownloadable
        bool rotationEnabled
        int downloadCount
    }
    CursorSet {
        int id PK
        string publicId UK
        string title
        uuid normalAssetId FK,UK
        uuid clickAssetId FK,UK
        int normalHotspotX
        int normalHotspotY
        int clickHotspotX
        int clickHotspotY
        bool isActive
        bool rotationEnabled
    }
    DailyContentSelection {
        int id PK
        RotationCategory category "UK(category,selectedDate)"
        date selectedDate
        int cycleNumber
        int backgroundId FK
        int musicId FK
        int profileMediaId FK
        int cursorSetId FK
    }
    ContentOverride {
        int id PK
        RotationCategory category UK
        int backgroundId FK
        int musicId FK
        int profileMediaId FK
        int cursorSetId FK
        timestamptz validUntil
    }
    DownloadEvent {
        bigint id PK
        DownloadTarget target
        int backgroundId FK
        int profileMediaId FK
        string visitorHash
        bool counted
        timestamptz createdAt
    }
    HeroSettings {
        int id PK "=1"
        string displayName
        string tagline
        string location
        NameEffect_array nameEffects
        ProfileMode profileMode
        int fixedProfileMediaId FK
    }
    SiteSettings {
        int id PK "=1"
        string navbarTitle
        uuid faviconAssetId FK
        json footerTechs
    }
    TechStackGroup ||--o{ TechStackItem : "içerir"
    TechStackGroup {
        int id PK
        string titleTop
        string titleMain
        string titleBottom
        bool published
        int sortOrder
    }
```

> `MediaAsset` silme işlemi DB tarafında cascade **etmez**; fiziksel dosyalar `StorageDeletionJob` kuyruğu üzerinden servis katmanında temizlenir (DATABASE.md §5.2). Bu yüzden `StorageDeletionJob` bir FK taşımaz.

---

## 3. Projeler, kategoriler ve linkler

```mermaid
erDiagram
    Project ||--o{ ProjectCategory : "sahip (Cascade)"
    Category ||--o{ ProjectCategory : "atanır (Restrict)"
    Project ||--o{ ProjectImage : "galeri (Cascade)"
    MediaAsset ||--o| ProjectImage : "görsel (Restrict)"
    MediaAsset ||--o| LinkItem : "görsel (Restrict)"
    Project |o--o{ AnalyticsEvent : "görüntülendi (SetNull)"

    Project {
        int id PK
        string slug UK
        string title
        text description
        string demoUrl
        string videoUrl
        string githubUrl
        bool isPublished
        int sortOrder
        int viewCount
        timestamptz publishedAt
    }
    Category {
        int id PK
        string name
        string nameKey UK
        bool isActive
        int sortOrder
    }
    ProjectCategory {
        int projectId PK,FK
        int categoryId PK,FK
        timestamptz assignedAt
    }
    ProjectImage {
        int id PK
        int projectId FK
        uuid assetId FK,UK
        string alt
        int sortOrder
    }
    LinkItem {
        int id PK
        string title "benzersiz değil"
        string url
        uuid imageAssetId FK,UK
        bool isActive
        int sortOrder
    }
    MediaAsset {
        uuid id PK
        MediaKind kind
    }
    AnalyticsEvent {
        bigint id PK
        AnalyticsEventType type
        string path
        int projectId FK
        string visitorHash
        date day
    }
```

`Project }o--o{ Category` çoka-çok ilişkisi `ProjectCategory` ara tablosuyla modellenir (Şartname §7.2).

---

## 4. Bağımsız tablolar (FK'siz)

```mermaid
erDiagram
    AboutContent {
        int id PK "=1"
        string title
        text bodyMarkdown
    }
    LegalDocument {
        int id PK
        LegalDocKey key UK
        string title
        text bodyMarkdown
        int version
    }
    MessageTemplate {
        int id PK
        TemplateKey key UK
        TemplateChannel channel
        string subject
        text body
        bool isSystem
    }
    IntegrationSetting {
        int id PK
        IntegrationProvider provider UK
        bool isEnabled
        json config
        string secretsEnc
        IntegrationStatus status
        json publicSnapshot
        timestamptz snapshotAt
        string lastError
    }
    ContactMessage {
        uuid id PK
        string firstName
        string lastName
        string phone
        string email
        string subject
        text message
        bool isRead
        ContactStatus status
        bool isSpam
        timestamptz retentionUntil
    }
    CookieConsentRecord {
        uuid id PK
        int version
        bool analytics
    }
```

---

## 5. Özet ilişki tablosu

| İlişki | Tür | onDelete |
|---|---|---|
| AdminUser → AdminSession / PasswordResetToken / RecoveryCode | 1:N | Cascade |
| AdminUser → AuditLog / MediaAsset / ContentOverride | 1:N (opsiyonel) | SetNull |
| MediaAsset → içerik sahibi (Background, Music×2, ProfileMedia, CursorSet×2, ProjectImage, LinkItem) | 1:1 | Restrict |
| MediaAsset → SiteSettings (favicon) | 1:N | SetNull |
| İçerik → DailyContentSelection | 1:N | SetNull |
| İçerik → ContentOverride | 1:0..1 | Cascade |
| ProfileMedia → HeroSettings (sabit profil) | 1:N | SetNull |
| Project ↔ Category (ProjectCategory) | N:M | Project: Cascade · Category: Restrict |
| Project → ProjectImage | 1:N | Cascade |
| Background (duvar kağıdı) / ProfileMedia → DownloadEvent | 1:N | SetNull |
| Project → AnalyticsEvent | 1:N | SetNull |
