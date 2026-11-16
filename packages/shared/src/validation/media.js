// ROUTES.md §4.6, CMS.md §8 — medya içerik türleri (F7): dosya yuvaları, anahtarlar ve form şemaları.
// İstemci (formlar) ve sunucu (multipart + JSON PATCH) aynı şemayı kullanır.
import { z } from 'zod';

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const MEDIA_TITLE_MAX = 120;
export const CURSOR_MAX_DIMENSION = 128;
export const REORDER_MAX_IDS = 500;

/**
 * Tür tanımları. slots: dosya alanları (multipart alan adı → MediaKind).
 * flags: kayıttaki boolean anahtarlar. sortable: sortOrder alanı var mı (reorder ucu).
 * replaceAll: dosya değiştirmede tüm yuvalar birlikte zorunlu mu.
 */
export const MEDIA_CONTENT = Object.freeze({
  backgrounds: {
    slots: [{ field: 'file', kind: 'BACKGROUND' }],
    // isWallpaper: public /wallpapers sayfasında listelenir ve indirilebilir (ayrı duvar kağıdı türü yok).
    flags: ['isActive', 'rotationEnabled', 'isWallpaper'],
    sortable: true,
    replaceAll: true,
  },
  musics: {
    slots: [
      { field: 'audio', kind: 'MUSIC_AUDIO' },
      { field: 'cover', kind: 'MUSIC_COVER' },
    ],
    flags: ['isActive', 'rotationEnabled'],
    sortable: true,
    replaceAll: false,
  },
  pfps: {
    slots: [{ field: 'file', kind: 'PROFILE' }],
    flags: ['isActive', 'isDownloadable', 'rotationEnabled'],
    sortable: false,
    replaceAll: true,
  },
  // 2026-11-16 — Hero isim GIF katmanı (SRS FR-HERO-05).
  'name-overlays': {
    slots: [{ field: 'file', kind: 'NAME_OVERLAY' }],
    flags: ['isActive', 'rotationEnabled'],
    sortable: true,
    replaceAll: true,
  },
  cursors: {
    slots: [
      { field: 'normal', kind: 'CURSOR' },
      { field: 'click', kind: 'CURSOR' },
    ],
    flags: ['isActive', 'rotationEnabled'],
    sortable: true,
    replaceAll: true,
  },
});

export const MEDIA_CONTENT_TYPES = Object.freeze(Object.keys(MEDIA_CONTENT));

export const HOTSPOT_FIELDS = Object.freeze([
  'normalHotspotX',
  'normalHotspotY',
  'clickHotspotX',
  'clickHotspotY',
]);

const title = z
  .string({ error: 'Başlık zorunlu.' })
  .transform((v) => v.replace(CONTROL_CHARS, '').trim())
  .pipe(
    z
      .string()
      .min(1, 'Başlık zorunlu.')
      .max(MEDIA_TITLE_MAX, `Başlık en fazla ${MEDIA_TITLE_MAX} karakter olabilir.`),
  );

const artist = z
  .union([z.string(), z.null()])
  .transform((v) => (v ?? '').replace(CONTROL_CHARS, '').trim() || null)
  .pipe(z.string().max(120, 'Sanatçı en fazla 120 karakter olabilir.').nullable());

/** multipart alanları metin gelir: "true"/"false" da kabul edilir. */
const flag = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')], {
  error: 'Açık/kapalı değeri geçersiz.',
});

const hotspot = z
  .union(
    [
      z.number(),
      z
        .string()
        .regex(/^\d{1,3}$/)
        .transform(Number),
    ],
    {
      error: 'Hotspot tam sayı olmalı.',
    },
  )
  .pipe(
    z
      .number()
      .int('Hotspot tam sayı olmalı.')
      .min(0, 'Hotspot negatif olamaz.')
      .max(CURSOR_MAX_DIMENSION - 1, 'Hotspot görsel sınırları içinde olmalı.'),
  );

const flagShape = (flags) => Object.fromEntries(flags.map((f) => [f, flag.optional()]));

function shapeFor(type) {
  const def = MEDIA_CONTENT[type];
  const shape = { title, ...flagShape(def.flags) };
  if (type === 'musics') shape.artist = artist.optional();
  if (type === 'cursors') for (const f of HOTSPOT_FIELDS) shape[f] = hotspot.optional();
  return shape;
}

/** Oluşturma (multipart alanları): başlık zorunlu, anahtarlar opsiyonel (DB varsayılanı). */
export const mediaCreateSchema = (type) => z.object(shapeFor(type)).strict();

/** Alan güncelleme (PATCH, dosya değişmez): en az bir alan. */
export const mediaUpdateSchema = (type) =>
  z
    .object(shapeFor(type))
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });

/** Dosya değiştirme (PUT /:id/file) yanındaki alanlar: yalnızca cursor hotspot'ları. */
export const mediaReplaceSchema = (type) =>
  z
    .object(
      type === 'cursors'
        ? Object.fromEntries(HOTSPOT_FIELDS.map((f) => [f, hotspot.optional()]))
        : {},
    )
    .strict();

export const reorderSchema = z
  .object({
    ids: z
      .array(z.number().int().positive())
      .min(1, 'Sıralanacak kayıt yok.')
      .max(REORDER_MAX_IDS)
      .refine((ids) => new Set(ids).size === ids.length, 'Aynı kayıt iki kez gönderilemez.'),
  })
  .strict();
