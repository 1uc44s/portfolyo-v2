-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'EDITOR');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('BACKGROUND', 'MUSIC_AUDIO', 'MUSIC_COVER', 'PROFILE', 'CURSOR', 'WALLPAPER', 'PROJECT_IMAGE', 'LINK_IMAGE', 'FAVICON');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'ANIMATED_IMAGE', 'VIDEO', 'AUDIO', 'CURSOR');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RotationCategory" AS ENUM ('BACKGROUND', 'MUSIC', 'PFP', 'CURSOR');

-- CreateEnum
CREATE TYPE "NameEffect" AS ENUM ('NEON', 'GRADIENT', 'PARTICLES', 'STARS');

-- CreateEnum
CREATE TYPE "ProfileMode" AS ENUM ('ROTATION', 'FIXED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('DISCORD', 'SPOTIFY', 'GITHUB');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'REPLIED');

-- CreateEnum
CREATE TYPE "DownloadTarget" AS ENUM ('WALLPAPER', 'PFP');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('PAGE_VIEW', 'PROJECT_VIEW');

-- CreateEnum
CREATE TYPE "TemplateChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "TemplateKey" AS ENUM ('PASSWORD_RESET', 'CONTACT_NOTIFICATION', 'SMTP_TEST', 'CONTACT_REPLY_EMAIL', 'CONTACT_REPLY_WHATSAPP');

-- CreateEnum
CREATE TYPE "LegalDocKey" AS ENUM ('KVKK_NOTICE', 'COOKIE_POLICY');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" VARCHAR(80),
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_changed_at" TIMESTAMPTZ(3),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret_enc" TEXT,
    "totp_pending_secret_enc" TEXT,
    "last_totp_step" BIGINT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "remember_me" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_reason" VARCHAR(40),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "request_ip_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "smtp_host" VARCHAR(255),
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN NOT NULL DEFAULT true,
    "smtp_user" VARCHAR(255),
    "app_password_enc" TEXT,
    "from_name" VARCHAR(80),
    "from_email" VARCHAR(254),
    "notify_on_contact" BOOLEAN NOT NULL DEFAULT false,
    "notify_email" VARCHAR(254),
    "last_test_at" TIMESTAMPTZ(3),
    "last_test_ok" BOOLEAN,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mail_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "navbar_title" VARCHAR(40) NOT NULL DEFAULT 'vasquez',
    "favicon_asset_id" UUID,
    "footer_techs" JSONB NOT NULL DEFAULT '[]',
    "tech_stack_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "display_name" VARCHAR(60) NOT NULL DEFAULT '',
    "tagline" VARCHAR(160),
    "location" VARCHAR(80),
    "name_effects" "NameEffect"[] DEFAULT ARRAY[]::"NameEffect"[],
    "profile_mode" "ProfileMode" NOT NULL DEFAULT 'ROTATION',
    "fixed_profile_media_id" INTEGER,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hero_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "about_content" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(80) NOT NULL DEFAULT 'Hakkımda',
    "body_markdown" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "about_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" SERIAL NOT NULL,
    "key" "LegalDocKey" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" SERIAL NOT NULL,
    "key" "TemplateKey" NOT NULL,
    "channel" "TemplateChannel" NOT NULL,
    "subject" VARCHAR(200),
    "body" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "MediaKind" NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "poster_key" TEXT,
    "thumbnail_key" TEXT,
    "download_key" TEXT,
    "original_filename" VARCHAR(255) NOT NULL,
    "safe_filename" VARCHAR(100) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(10) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "total_bytes" INTEGER NOT NULL DEFAULT 0,
    "sha256" CHAR(64) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processing_error" VARCHAR(500),
    "metadata" JSONB,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_deletion_jobs" (
    "id" BIGSERIAL NOT NULL,
    "storage_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "next_run_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backgrounds" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "asset_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "musics" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "artist" VARCHAR(120),
    "audio_asset_id" UUID NOT NULL,
    "cover_asset_id" UUID NOT NULL,
    "duration_ms" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "musics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_media" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "asset_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_downloadable" BOOLEAN NOT NULL DEFAULT false,
    "rotation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "profile_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursor_sets" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "normal_asset_id" UUID NOT NULL,
    "click_asset_id" UUID NOT NULL,
    "normal_hotspot_x" INTEGER NOT NULL DEFAULT 0,
    "normal_hotspot_y" INTEGER NOT NULL DEFAULT 0,
    "click_hotspot_x" INTEGER NOT NULL DEFAULT 0,
    "click_hotspot_y" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rotation_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cursor_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallpapers" (
    "id" SERIAL NOT NULL,
    "public_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "asset_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_downloadable" BOOLEAN NOT NULL DEFAULT true,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallpapers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_content_selections" (
    "id" SERIAL NOT NULL,
    "category" "RotationCategory" NOT NULL,
    "selected_date" DATE NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "background_id" INTEGER,
    "music_id" INTEGER,
    "profile_media_id" INTEGER,
    "cursor_set_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_content_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_overrides" (
    "id" SERIAL NOT NULL,
    "category" "RotationCategory" NOT NULL,
    "background_id" INTEGER,
    "music_id" INTEGER,
    "profile_media_id" INTEGER,
    "cursor_set_id" INTEGER,
    "valid_until" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "name_key" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "demo_url" VARCHAR(2048),
    "video_url" VARCHAR(2048),
    "github_url" VARCHAR(2048),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_categories" (
    "project_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_categories_pkey" PRIMARY KEY ("project_id","category_id")
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "asset_id" UUID NOT NULL,
    "alt" VARCHAR(160),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_items" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "image_asset_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "link_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_settings" (
    "id" SERIAL NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secrets_enc" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "last_sync_at" TIMESTAMPTZ(3),
    "last_success_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "public_snapshot" JSONB,
    "snapshot_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "first_name" VARCHAR(60) NOT NULL,
    "last_name" VARCHAR(60) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "replied_at" TIMESTAMPTZ(3),
    "is_spam" BOOLEAN NOT NULL DEFAULT false,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(400),
    "retention_until" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "download_events" (
    "id" BIGSERIAL NOT NULL,
    "target" "DownloadTarget" NOT NULL,
    "wallpaper_id" INTEGER,
    "profile_media_id" INTEGER,
    "visitor_hash" VARCHAR(64),
    "counted" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "download_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "project_id" INTEGER,
    "visitor_hash" VARCHAR(64) NOT NULL,
    "day" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_consent_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL,
    "analytics" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cookie_consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40),
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(400),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_state" (
    "key" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_refresh_token_hash_key" ON "admin_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_sessions_family_id_idx" ON "admin_sessions"("family_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_admin_id_idx" ON "password_reset_tokens"("admin_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_codes_admin_id_code_hash_key" ON "recovery_codes"("admin_id", "code_hash");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_key_key" ON "legal_documents"("key");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_key_key" ON "message_templates"("key");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "media_assets_kind_created_at_idx" ON "media_assets"("kind", "created_at" DESC);

-- CreateIndex
CREATE INDEX "media_assets_sha256_idx" ON "media_assets"("sha256");

-- CreateIndex
CREATE INDEX "media_assets_processing_status_idx" ON "media_assets"("processing_status");

-- CreateIndex
CREATE INDEX "storage_deletion_jobs_processed_at_next_run_at_idx" ON "storage_deletion_jobs"("processed_at", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "backgrounds_public_id_key" ON "backgrounds"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "backgrounds_asset_id_key" ON "backgrounds"("asset_id");

-- CreateIndex
CREATE INDEX "backgrounds_is_active_rotation_enabled_idx" ON "backgrounds"("is_active", "rotation_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "musics_public_id_key" ON "musics"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "musics_audio_asset_id_key" ON "musics"("audio_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "musics_cover_asset_id_key" ON "musics"("cover_asset_id");

-- CreateIndex
CREATE INDEX "musics_is_active_rotation_enabled_idx" ON "musics"("is_active", "rotation_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "profile_media_public_id_key" ON "profile_media"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_media_asset_id_key" ON "profile_media"("asset_id");

-- CreateIndex
CREATE INDEX "profile_media_is_active_is_downloadable_id_idx" ON "profile_media"("is_active", "is_downloadable", "id");

-- CreateIndex
CREATE INDEX "profile_media_is_active_rotation_enabled_idx" ON "profile_media"("is_active", "rotation_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "cursor_sets_public_id_key" ON "cursor_sets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "cursor_sets_normal_asset_id_key" ON "cursor_sets"("normal_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "cursor_sets_click_asset_id_key" ON "cursor_sets"("click_asset_id");

-- CreateIndex
CREATE INDEX "cursor_sets_is_active_rotation_enabled_idx" ON "cursor_sets"("is_active", "rotation_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "wallpapers_public_id_key" ON "wallpapers"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallpapers_asset_id_key" ON "wallpapers"("asset_id");

-- CreateIndex
CREATE INDEX "wallpapers_is_active_is_downloadable_id_idx" ON "wallpapers"("is_active", "is_downloadable", "id");

-- CreateIndex
CREATE INDEX "daily_content_selections_category_cycle_number_idx" ON "daily_content_selections"("category", "cycle_number");

-- CreateIndex
CREATE UNIQUE INDEX "daily_content_selections_category_selected_date_key" ON "daily_content_selections"("category", "selected_date");

-- CreateIndex
CREATE UNIQUE INDEX "content_overrides_category_key" ON "content_overrides"("category");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key_key" ON "categories"("name_key");

-- CreateIndex
CREATE INDEX "categories_is_active_sort_order_idx" ON "categories"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_is_published_sort_order_id_idx" ON "projects"("is_published", "sort_order", "id");

-- CreateIndex
CREATE INDEX "project_categories_category_id_idx" ON "project_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_images_asset_id_key" ON "project_images"("asset_id");

-- CreateIndex
CREATE INDEX "project_images_project_id_sort_order_idx" ON "project_images"("project_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "link_items_image_asset_id_key" ON "link_items"("image_asset_id");

-- CreateIndex
CREATE INDEX "link_items_is_active_sort_order_id_idx" ON "link_items"("is_active", "sort_order", "id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_settings_provider_key" ON "integration_settings"("provider");

-- CreateIndex
CREATE INDEX "contact_messages_is_spam_is_read_created_at_idx" ON "contact_messages"("is_spam", "is_read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "contact_messages_status_idx" ON "contact_messages"("status");

-- CreateIndex
CREATE INDEX "contact_messages_retention_until_idx" ON "contact_messages"("retention_until");

-- CreateIndex
CREATE INDEX "download_events_wallpaper_id_visitor_hash_created_at_idx" ON "download_events"("wallpaper_id", "visitor_hash", "created_at");

-- CreateIndex
CREATE INDEX "download_events_profile_media_id_visitor_hash_created_at_idx" ON "download_events"("profile_media_id", "visitor_hash", "created_at");

-- CreateIndex
CREATE INDEX "download_events_created_at_idx" ON "download_events"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_type_day_idx" ON "analytics_events"("type", "day");

-- CreateIndex
CREATE INDEX "analytics_events_day_visitor_hash_idx" ON "analytics_events"("day", "visitor_hash");

-- CreateIndex
CREATE INDEX "analytics_events_project_id_day_idx" ON "analytics_events"("project_id", "day");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_favicon_asset_id_fkey" FOREIGN KEY ("favicon_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hero_settings" ADD CONSTRAINT "hero_settings_fixed_profile_media_id_fkey" FOREIGN KEY ("fixed_profile_media_id") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backgrounds" ADD CONSTRAINT "backgrounds_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "musics" ADD CONSTRAINT "musics_audio_asset_id_fkey" FOREIGN KEY ("audio_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "musics" ADD CONSTRAINT "musics_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursor_sets" ADD CONSTRAINT "cursor_sets_normal_asset_id_fkey" FOREIGN KEY ("normal_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursor_sets" ADD CONSTRAINT "cursor_sets_click_asset_id_fkey" FOREIGN KEY ("click_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallpapers" ADD CONSTRAINT "wallpapers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content_selections" ADD CONSTRAINT "daily_content_selections_background_id_fkey" FOREIGN KEY ("background_id") REFERENCES "backgrounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content_selections" ADD CONSTRAINT "daily_content_selections_music_id_fkey" FOREIGN KEY ("music_id") REFERENCES "musics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content_selections" ADD CONSTRAINT "daily_content_selections_profile_media_id_fkey" FOREIGN KEY ("profile_media_id") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_content_selections" ADD CONSTRAINT "daily_content_selections_cursor_set_id_fkey" FOREIGN KEY ("cursor_set_id") REFERENCES "cursor_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_background_id_fkey" FOREIGN KEY ("background_id") REFERENCES "backgrounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_music_id_fkey" FOREIGN KEY ("music_id") REFERENCES "musics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_profile_media_id_fkey" FOREIGN KEY ("profile_media_id") REFERENCES "profile_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_cursor_set_id_fkey" FOREIGN KEY ("cursor_set_id") REFERENCES "cursor_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_overrides" ADD CONSTRAINT "content_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_categories" ADD CONSTRAINT "project_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_categories" ADD CONSTRAINT "project_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_items" ADD CONSTRAINT "link_items_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_wallpaper_id_fkey" FOREIGN KEY ("wallpaper_id") REFERENCES "wallpapers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_profile_media_id_fkey" FOREIGN KEY ("profile_media_id") REFERENCES "profile_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
