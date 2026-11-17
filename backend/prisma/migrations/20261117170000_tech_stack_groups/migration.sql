-- 2026-11-17 — Tech Stack çoğaltılabilir bölümler (kullanıcı isteği): "My Tech Stack" dışında
-- "My Security Skill" gibi ayrı başlıklı, ayrı öğeli bölümler. Tekil SiteSettings alanları
-- tech_stack_groups tablosuna taşınır; mevcut öğeler ilk bölüme bağlanır. Veri kaybı yok.

-- CreateTable
CREATE TABLE "tech_stack_groups" (
    "id" SERIAL NOT NULL,
    "title_top" VARCHAR(20) NOT NULL DEFAULT 'My',
    "title_main" VARCHAR(40) NOT NULL DEFAULT 'Security',
    "title_bottom" VARCHAR(40) NOT NULL DEFAULT 'Skill',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tech_stack_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tech_stack_groups_published_sort_order_id_idx" ON "tech_stack_groups"("published", "sort_order", "id");

-- Data: mevcut tekil bölüm (başlık + yayın durumu) ilk bölüm olur.
INSERT INTO "tech_stack_groups" ("title_top", "title_main", "title_bottom", "published", "sort_order", "updated_at")
SELECT "tech_stack_title_top", "tech_stack_title_main", "tech_stack_title_bottom", "tech_stack_published", 0, CURRENT_TIMESTAMP
FROM "site_settings"
WHERE "id" = 1;

-- Data: site_settings satırı yoksa (boş kurulum) varsayılan "My Tech Stack".
INSERT INTO "tech_stack_groups" ("title_top", "title_main", "title_bottom", "published", "sort_order", "updated_at")
SELECT 'My', 'Tech', 'Stack', false, 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "tech_stack_groups");

-- Data: varsayılan ikinci bölüm "My Security Skill" (yayında değil, öğesiz).
INSERT INTO "tech_stack_groups" ("title_top", "title_main", "title_bottom", "published", "sort_order", "updated_at")
VALUES ('My', 'Security', 'Skill', false, 10, CURRENT_TIMESTAMP);

-- DropIndex
DROP INDEX "tech_stack_items_is_active_sort_order_id_idx";

-- AlterTable: önce boş bırakılabilir ekle, mevcut öğeleri ilk bölüme bağla, sonra zorunlu yap.
ALTER TABLE "tech_stack_items" ADD COLUMN "group_id" INTEGER;

UPDATE "tech_stack_items"
SET "group_id" = (SELECT "id" FROM "tech_stack_groups" ORDER BY "sort_order", "id" LIMIT 1);

ALTER TABLE "tech_stack_items" ALTER COLUMN "group_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "tech_stack_items_group_id_is_active_sort_order_id_idx" ON "tech_stack_items"("group_id", "is_active", "sort_order", "id");

-- AddForeignKey
ALTER TABLE "tech_stack_items" ADD CONSTRAINT "tech_stack_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "tech_stack_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: veriler taşındı; tekil alanlar kaldırılır.
ALTER TABLE "site_settings" DROP COLUMN "tech_stack_published",
DROP COLUMN "tech_stack_title_bottom",
DROP COLUMN "tech_stack_title_main",
DROP COLUMN "tech_stack_title_top";
