-- Açık kaynak: kişiye özel varsayılanlar genel değerlerle değiştirildi (mevcut kayıtlar değişmez).

-- AlterTable
ALTER TABLE "hero_settings" ALTER COLUMN "display_name" SET DEFAULT 'My Portfolyo';

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "navbar_title" SET DEFAULT 'my-portfolyo';
