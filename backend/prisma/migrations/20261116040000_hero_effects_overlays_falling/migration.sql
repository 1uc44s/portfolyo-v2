-- 2026-11-16 — İsim efektleri (PARTICLES/STARS kaldırıldı; GRADIENT_ANIMATED, OVERLAY + gradyan renkleri),
-- isim GIF katmanı (NameOverlay, rotasyon NAME_OVERLAY), Discord banner, yağan öğeler (FallingItem).
UPDATE hero_settings SET name_effects = array_remove(array_remove(name_effects::text[], 'PARTICLES'), 'STARS')::"NameEffect"[];


-- CreateEnum
CREATE TYPE "FallingKind" AS ENUM ('IMAGE', 'TEXT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MediaKind" ADD VALUE 'NAME_OVERLAY';
ALTER TYPE "MediaKind" ADD VALUE 'DISCORD_BANNER';
ALTER TYPE "MediaKind" ADD VALUE 'FALLING_IMAGE';

-- AlterEnum
BEGIN;
CREATE TYPE "NameEffect_new" AS ENUM ('NEON', 'GRADIENT', 'GRADIENT_ANIMATED', 'OVERLAY');
ALTER TABLE "public"."hero_settings" ALTER COLUMN "name_effects" DROP DEFAULT;
ALTER TABLE "hero_settings" ALTER COLUMN "name_effects" TYPE "NameEffect_new"[] USING ("name_effects"::text::"NameEffect_new"[]);
ALTER TYPE "NameEffect" RENAME TO "NameEffect_old";
ALTER TYPE "NameEffect_new" RENAME TO "NameEffect";
DROP TYPE "public"."NameEffect_old";
ALTER TABLE "hero_settings" ALTER COLUMN "name_effects" SET DEFAULT ARRAY[]::"NameEffect"[];
COMMIT;

-- AlterEnum
ALTER TYPE "RotationCategory" ADD VALUE 'NAME_OVERLAY';

-- AlterTable
ALTER TABLE "content_overrides" ADD COLUMN     "name_overlay_id" INTEGER;

-- AlterTable
ALTER TABLE "daily_content_selections" ADD COLUMN     "name_overlay_id" INTEGER;

-- AlterTable
ALTER TABLE "hero_settings" ADD COLUMN     "gradient_from" VARCHAR(7) NOT NULL DEFAULT '#a78bfa',
ADD COLUMN     "gradient_to" VARCHAR(7) NOT NULL DEFAULT '#f472b6';

-- AlterTable
ALTER TABLE "integration_settings" ADD COLUMN     "banner_asset_id" UUID;

-- CreateTable
CREATE TABLE "name_overlays" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "asset_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "name_overlays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "falling_items" (
    "id" SERIAL NOT NULL,
    "kind" "FallingKind" NOT NULL,
    "text" VARCHAR(16),
    "image_asset_id" UUID,
    "size" INTEGER NOT NULL DEFAULT 24,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "falling_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "name_overlays_public_id_key" ON "name_overlays"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "name_overlays_asset_id_key" ON "name_overlays"("asset_id");

-- CreateIndex
CREATE INDEX "name_overlays_is_active_rotation_enabled_idx" ON "name_overlays"("is_active", "rotation_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "falling_items_image_asset_id_key" ON "falling_items"("image_asset_id");

-- CreateIndex
CREATE INDEX "falling_items_is_active_sort_order_id_idx" ON "falling_items"("is_active", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_banner_asset_id_key" ON "integration_settings"("banner_asset_id");

-- AddForeignKey
ALTER TABLE "name_overlays" ADD CONSTRAINT "name_overlays_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "falling_items" ADD CONSTRAINT "falling_items_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content_selections" ADD CONSTRAINT "daily_content_selections_name_overlay_id_fkey" FOREIGN KEY ("name_overlay_id") REFERENCES "name_overlays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_name_overlay_id_fkey" FOREIGN KEY ("name_overlay_id") REFERENCES "name_overlays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_banner_asset_id_fkey" FOREIGN KEY ("banner_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

