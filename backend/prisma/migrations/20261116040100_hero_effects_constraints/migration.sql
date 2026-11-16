-- 2026-11-16 — Yeni enum değerleri ayrı işlemde kullanılabilir: rotasyon CHECK'leri NAME_OVERLAY ile, yağan öğe kısıtları.
ALTER TABLE daily_content_selections DROP CONSTRAINT dcs_category_fk;
ALTER TABLE daily_content_selections ADD CONSTRAINT dcs_category_fk CHECK (
  (category = 'BACKGROUND'   AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'MUSIC'        AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'PFP'          AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'CURSOR'       AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'NAME_OVERLAY' AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL)
);
ALTER TABLE content_overrides DROP CONSTRAINT co_category_fk;
ALTER TABLE content_overrides ADD CONSTRAINT co_category_fk CHECK (
  (category = 'BACKGROUND'   AND background_id    IS NOT NULL AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'MUSIC'        AND music_id         IS NOT NULL AND background_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'PFP'          AND profile_media_id IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND cursor_set_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'CURSOR'       AND cursor_set_id    IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL AND name_overlay_id IS NULL) OR
  (category = 'NAME_OVERLAY' AND name_overlay_id  IS NOT NULL AND background_id IS NULL AND music_id IS NULL AND profile_media_id IS NULL AND cursor_set_id IS NULL)
);

ALTER TABLE falling_items ADD CONSTRAINT falling_items_size_range CHECK (size BETWEEN 12 AND 64);
ALTER TABLE falling_items ADD CONSTRAINT falling_items_kind_payload CHECK (
  (kind = 'IMAGE' AND image_asset_id IS NOT NULL AND text IS NULL) OR
  (kind = 'TEXT'  AND text IS NOT NULL AND image_asset_id IS NULL)
);
ALTER TABLE hero_settings ADD CONSTRAINT hero_gradient_hex CHECK (
  gradient_from ~ '^#[0-9a-fA-F]{6}$' AND gradient_to ~ '^#[0-9a-fA-F]{6}$'
);
