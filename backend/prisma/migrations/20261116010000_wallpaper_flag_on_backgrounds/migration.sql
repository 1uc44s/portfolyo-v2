-- 2026-11-16 — Duvar kağıtları ayrı tablo değil: Background.isWallpaper bayrağı (kullanıcı onaylı, dev'de wallpaper verisi 0).
-- download_events.wallpaper_id → background_id; wallpapers tablosu ve MediaKind.WALLPAPER kaldırılır.

-- AlterEnum
BEGIN;
CREATE TYPE "MediaKind_new" AS ENUM ('BACKGROUND', 'MUSIC_AUDIO', 'MUSIC_COVER', 'PROFILE', 'CURSOR', 'PROJECT_IMAGE', 'LINK_IMAGE', 'FAVICON', 'TECH_STACK_IMAGE');
ALTER TABLE "media_assets" ALTER COLUMN "kind" TYPE "MediaKind_new" USING ("kind"::text::"MediaKind_new");
ALTER TYPE "MediaKind" RENAME TO "MediaKind_old";
ALTER TYPE "MediaKind_new" RENAME TO "MediaKind";
DROP TYPE "public"."MediaKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "download_events" DROP CONSTRAINT "download_events_wallpaper_id_fkey";

-- DropForeignKey
ALTER TABLE "wallpapers" DROP CONSTRAINT "wallpapers_asset_id_fkey";

-- DropIndex
DROP INDEX "download_events_wallpaper_id_visitor_hash_created_at_idx";

-- AlterTable
ALTER TABLE "backgrounds" ADD COLUMN     "download_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_wallpaper" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "download_events" DROP COLUMN "wallpaper_id",
ADD COLUMN     "background_id" INTEGER;

-- DropTable
DROP TABLE "wallpapers";

-- CreateIndex
CREATE INDEX "backgrounds_is_active_is_wallpaper_id_idx" ON "backgrounds"("is_active", "is_wallpaper", "id");

-- CreateIndex
CREATE INDEX "download_events_background_id_visitor_hash_created_at_idx" ON "download_events"("background_id", "visitor_hash", "created_at");

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_background_id_fkey" FOREIGN KEY ("background_id") REFERENCES "backgrounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Sayaç negatif olamaz (constraints migration'ındaki wallpapers_dl_nonneg'in yerine).
ALTER TABLE backgrounds ADD CONSTRAINT backgrounds_dl_nonneg CHECK (download_count >= 0);
