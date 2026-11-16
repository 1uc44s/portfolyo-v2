-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'TECH_STACK_IMAGE';

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "tech_stack_emblem_asset_id" UUID,
ADD COLUMN     "tech_stack_title_bottom" VARCHAR(40) NOT NULL DEFAULT 'Stack',
ADD COLUMN     "tech_stack_title_main" VARCHAR(40) NOT NULL DEFAULT 'Tech',
ADD COLUMN     "tech_stack_title_top" VARCHAR(20) NOT NULL DEFAULT '7';

-- CreateTable
CREATE TABLE "tech_stack_items" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_asset_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tech_stack_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tech_stack_items_image_asset_id_key" ON "tech_stack_items"("image_asset_id");

-- CreateIndex
CREATE INDEX "tech_stack_items_is_active_sort_order_id_idx" ON "tech_stack_items"("is_active", "sort_order", "id");

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tech_stack_emblem_asset_id_fkey" FOREIGN KEY ("tech_stack_emblem_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_stack_items" ADD CONSTRAINT "tech_stack_items_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
