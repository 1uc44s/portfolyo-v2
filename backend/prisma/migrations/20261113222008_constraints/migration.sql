-- DATABASE.md §6 — Prisma'nın ifade edemediği kısıtlar ve kısmi index'ler.

-- Singleton'lar
ALTER TABLE site_settings  ADD CONSTRAINT site_settings_singleton  CHECK (id = 1);
ALTER TABLE hero_settings  ADD CONSTRAINT hero_settings_singleton  CHECK (id = 1);
ALTER TABLE about_content  ADD CONSTRAINT about_content_singleton  CHECK (id = 1);
ALTER TABLE mail_settings  ADD CONSTRAINT mail_settings_singleton  CHECK (id = 1);

-- Proje: en az bir link
ALTER TABLE projects ADD CONSTRAINT projects_at_least_one_link
  CHECK (demo_url IS NOT NULL OR video_url IS NOT NULL OR github_url IS NOT NULL);

-- URL protokolü (savunma derinliği; asıl kontrol Zod'da)
ALTER TABLE link_items ADD CONSTRAINT link_items_url_http CHECK (url ~* '^https?://');
ALTER TABLE projects   ADD CONSTRAINT projects_urls_http CHECK (
  (demo_url   IS NULL OR demo_url   ~* '^https?://') AND
  (video_url  IS NULL OR video_url  ~* '^https?://') AND
  (github_url IS NULL OR github_url ~* '^https?://')
);

-- Rotasyon: kategoriye uygun tek FK
ALTER TABLE daily_content_selections ADD CONSTRAINT dcs_category_fk CHECK (
  (category = 'BACKGROUND' AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'MUSIC'      AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'PFP'        AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'CURSOR'     AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL)
);
ALTER TABLE content_overrides ADD CONSTRAINT co_category_fk CHECK (
  (category = 'BACKGROUND' AND background_id    IS NOT NULL AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'MUSIC'      AND music_id         IS NOT NULL AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'PFP'        AND profile_media_id IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL) OR
  (category = 'CURSOR'     AND cursor_set_id    IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL)
);

-- Hero efektleri en fazla 4 (tekrarsızlık Zod şemasında garanti edilir)
ALTER TABLE hero_settings ADD CONSTRAINT hero_effects_max CHECK (cardinality(name_effects) <= 4);

-- Sayaçlar negatif olamaz
ALTER TABLE wallpapers    ADD CONSTRAINT wallpapers_dl_nonneg    CHECK (download_count >= 0);
ALTER TABLE profile_media ADD CONSTRAINT profile_media_dl_nonneg CHECK (download_count >= 0);
ALTER TABLE projects      ADD CONSTRAINT projects_views_nonneg   CHECK (view_count >= 0);

-- Kısmi index'ler (sık sorgular)
CREATE INDEX wallpapers_public_idx    ON wallpapers (id)    WHERE is_active AND is_downloadable;
CREATE INDEX profile_media_public_idx ON profile_media (id) WHERE is_active AND is_downloadable;
CREATE INDEX admin_sessions_live_idx  ON admin_sessions (admin_id) WHERE revoked_at IS NULL AND rotated_at IS NULL;
CREATE INDEX contact_unread_idx       ON contact_messages (created_at DESC) WHERE NOT is_read AND NOT is_spam;
