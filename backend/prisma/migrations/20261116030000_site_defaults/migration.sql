-- 2026-11-16 — Varsayılanlar (kullanıcı isteği): sekme/navbar başlığı, hero adı ve konumu.

-- AlterTable
ALTER TABLE "hero_settings" ALTER COLUMN "display_name" SET DEFAULT 'Lucas Vasquez',
ALTER COLUMN "location" SET DEFAULT 'Samsung Galaxy';

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "navbar_title" SET DEFAULT '1uc44s GitHub';

