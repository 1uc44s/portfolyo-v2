// kategori ve proje şemaları (istemci + sunucu aynı kurallar).
import { z } from 'zod';
import { httpUrl } from './url.js';

export const CATEGORY_NAME_MAX = 60;
export const PROJECT_TITLE_MAX = 120;
export const PROJECT_SLUG_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 20_000;
export const PROJECT_IMAGE_ALT_MAX = 160;
export const PROJECT_IMAGES_PER_REQUEST = 10;
export const PROJECT_CATEGORIES_MAX = 20;
export const EXCERPT_LENGTH = 160;
export const LINKS_REQUIRED_MESSAGE = 'En az bir bağlantı girmelisin: Demo, Video veya GitHub.';
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TR = {
  ı: 'i',
  İ: 'i',
  ş: 's',
  Ş: 's',
  ğ: 'g',
  Ğ: 'g',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

/** Başlıktan URL adı: Türkçe harfler sadeleşir, yalnızca [a-z0-9-]. Boşsa "proje". */
export function slugify(value, max = PROJECT_SLUG_MAX) {
  const slug = String(value ?? '')
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (c) => TR[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return slug || 'proje';
}

/**
 * Kart özeti: ilk paragrafın düz metni, en fazla 160 karakter.
 * Markdown sözdizimi kaba biçimde temizlenir; HTML üretilmez.
 */
export function excerptOf(markdown, max = EXCERPT_LENGTH) {
  const text = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/```[\s\S]*?```/g, '\n\n')
    .split(/\n\s*\n/)
    .filter((block) => !/^\s{0,3}#{1,6}\s/.test(block)) // başlıklar özet değildir
    .map((block) =>
      block
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
        .replace(/[*_~`]+/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .find((block) => block.length > 0);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (v) => v.replace(CONTROL_CHARS, '').trim();

const categoryName = z
  .string({ error: 'Kategori adı zorunlu.' })
  .transform((v) => clean(v).replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, 'Kategori adı zorunlu.')
      .max(CATEGORY_NAME_MAX, `Kategori adı en fazla ${CATEGORY_NAME_MAX} karakter olabilir.`),
  );

export const categoryCreateSchema = z
  .object({ name: categoryName, isActive: z.boolean().optional() })
  .strict();

export const categoryUpdateSchema = z
  .object({ name: categoryName.optional(), isActive: z.boolean().optional() })
  .strict();

export const categoryReassignSchema = z
  .object({ targetCategoryId: z.number().int().positive().nullable() })
  .strict();

/** Gönderilmeyen alan undefined kalır (PATCH'te dokunulmaz); boş metin / null → null. */
const emptyToNull = (v) => (v === undefined ? undefined : v || null);

/** Opsiyonel bağlantı. */
const optionalUrl = z
  .union([z.literal(''), z.null(), httpUrl()])
  .optional()
  .transform(emptyToNull);

const projectFields = {
  title: z
    .string({ error: 'Başlık zorunlu.' })
    .transform(clean)
    .pipe(
      z
        .string()
        .min(1, 'Başlık zorunlu.')
        .max(PROJECT_TITLE_MAX, `Başlık en fazla ${PROJECT_TITLE_MAX} karakter olabilir.`),
    ),
  description: z
    .string({ error: 'Açıklama zorunlu.' })
    .transform((v) => v.replace(CONTROL_CHARS, '').trim())
    .pipe(
      z
        .string()
        .min(1, 'Açıklama zorunlu.')
        .max(PROJECT_DESCRIPTION_MAX, 'Açıklama en fazla 20 000 karakter olabilir.'),
    ),
  slug: z
    .union([z.literal(''), z.null(), z.string().trim()])
    .optional()
    .transform(emptyToNull)
    .pipe(
      z
        .string()
        .max(PROJECT_SLUG_MAX, `Adres en fazla ${PROJECT_SLUG_MAX} karakter olabilir.`)
        .regex(SLUG_PATTERN, 'Adres yalnızca küçük harf, rakam ve tire içerebilir.')
        .nullable()
        .optional(),
    ),
  demoUrl: optionalUrl,
  videoUrl: optionalUrl,
  githubUrl: optionalUrl,
  categoryIds: z
    .array(z.number().int().positive())
    .max(PROJECT_CATEGORIES_MAX, `En fazla ${PROJECT_CATEGORIES_MAX} kategori seçilebilir.`)
    .transform((ids) => [...new Set(ids)]),
  isPublished: z.boolean(),
  sortOrder: z.number().int().min(0).max(1_000_000),
};

export const hasProjectLink = (p) => Boolean(p.demoUrl || p.videoUrl || p.githubUrl);

export const projectCreateSchema = z
  .object({
    ...projectFields,
    categoryIds: projectFields.categoryIds.default([]),
    isPublished: projectFields.isPublished.default(false),
    sortOrder: projectFields.sortOrder.optional(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (!hasProjectLink(p))
      ctx.addIssue({ code: 'custom', path: ['links'], message: LINKS_REQUIRED_MESSAGE });
  });

/** Kısmi güncelleme; "en az bir link" kuralı sunucuda birleşik kayıt üzerinde denetlenir. */
export const projectUpdateSchema = z
  .object(Object.fromEntries(Object.entries(projectFields).map(([k, v]) => [k, v.optional()])))
  .strict();

export const projectImageUpdateSchema = z
  .object({
    alt: z
      .union([z.null(), z.string().transform(clean)])
      .transform((v) => (v ? v : null))
      .pipe(
        z
          .string()
          .max(
            PROJECT_IMAGE_ALT_MAX,
            `Alt metin en fazla ${PROJECT_IMAGE_ALT_MAX} karakter olabilir.`,
          )
          .nullable(),
      ),
  })
  .strict();
