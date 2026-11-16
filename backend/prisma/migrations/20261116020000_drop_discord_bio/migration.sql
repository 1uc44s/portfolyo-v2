-- 2026-11-16 — Discord biyografisi kaldırıldı (kullanıcı isteği): admin config'indeki 'bio' anahtarı silinir.
UPDATE integration_settings SET config = config - 'bio' WHERE config ? 'bio';
