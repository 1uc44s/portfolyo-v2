-- 2026-11-17 — Varsayılan Tech Stack başlığı "7 Tech Stack" yerine "My Tech Stack" (kullanıcı isteği).
-- Yalnızca varsayılan değişir; mevcut kayıtlar (admin'den girilmiş başlık) korunur.

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "tech_stack_title_top" SET DEFAULT 'My';
