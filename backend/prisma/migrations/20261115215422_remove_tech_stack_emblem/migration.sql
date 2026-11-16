/*
  Warnings:

  - You are about to drop the column `tech_stack_emblem_asset_id` on the `site_settings` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "site_settings" DROP CONSTRAINT "site_settings_tech_stack_emblem_asset_id_fkey";

-- AlterTable
ALTER TABLE "site_settings" DROP COLUMN "tech_stack_emblem_asset_id";
