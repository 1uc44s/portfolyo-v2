-- 2026-11-16 — Discord manuel banner yükleme kaldırıldı (kullanıcı isteği; dev'de banner verisi 0).

-- AlterEnum
BEGIN;
CREATE TYPE "MediaKind_new" AS ENUM ('BACKGROUND', 'MUSIC_AUDIO', 'MUSIC_COVER', 'PROFILE', 'CURSOR', 'PROJECT_IMAGE', 'LINK_IMAGE', 'FAVICON', 'TECH_STACK_IMAGE', 'NAME_OVERLAY', 'FALLING_IMAGE');
ALTER TABLE "media_assets" ALTER COLUMN "kind" TYPE "MediaKind_new" USING ("kind"::text::"MediaKind_new");
ALTER TYPE "MediaKind" RENAME TO "MediaKind_old";
ALTER TYPE "MediaKind_new" RENAME TO "MediaKind";
DROP TYPE "public"."MediaKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "integration_settings" DROP CONSTRAINT "integration_settings_banner_asset_id_fkey";

-- DropIndex
DROP INDEX "integration_settings_banner_asset_id_key";

-- AlterTable
ALTER TABLE "integration_settings" DROP COLUMN "banner_asset_id";

