// yağan öğeler: görsel (FALLING_IMAGE) veya kısa metin (emoji, harf, sayı).
import { z } from 'zod';

export const FALLING_LIMITS = Object.freeze({
  maxItems: 20,
  maxText: 8, // grafem (emoji tek sayılır)
  minSize: 12,
  maxSize: 64,
  defaultSize: 24,
  maxParticles: 30,
});
export const FALLING_KINDS = Object.freeze(['IMAGE', 'TEXT']);

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const graphemes = (v) =>
  typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(v)].length
    : Array.from(v).length;

const text = z
  .string({ error: 'Metin zorunlu.' })
  .transform((v) => v.replace(CONTROL_CHARS, '').trim())
  .pipe(
    z
      .string()
      .min(1, 'Metin zorunlu.')
      .max(16, `En fazla ${FALLING_LIMITS.maxText} karakter.`)
      .refine((v) => graphemes(v) <= FALLING_LIMITS.maxText, {
        message: `En fazla ${FALLING_LIMITS.maxText} karakter (emoji, harf veya sayı).`,
      }),
  );

/** multipart'ta sayılar/anahtarlar metin gelir. */
const size = z.coerce
  .number({ error: 'Boyut sayı olmalı.' })
  .int('Boyut tam sayı olmalı.')
  .min(FALLING_LIMITS.minSize, `Boyut en az ${FALLING_LIMITS.minSize} px.`)
  .max(FALLING_LIMITS.maxSize, `Boyut en fazla ${FALLING_LIMITS.maxSize} px.`);
const flag = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

/** Oluşturma (multipart): IMAGE → dosya `image` alanında (route kontrol eder); TEXT → `text` zorunlu. */
export const fallingItemCreateSchema = z
  .discriminatedUnion('kind', [
    z
      .object({ kind: z.literal('IMAGE'), size: size.optional(), isActive: flag.optional() })
      .strict(),
    z
      .object({ kind: z.literal('TEXT'), text, size: size.optional(), isActive: flag.optional() })
      .strict(),
  ])
  .transform((v) => ({
    ...v,
    size: v.size ?? FALLING_LIMITS.defaultSize,
    isActive: v.isActive ?? true,
  }));

export const fallingItemUpdateSchema = z
  .object({ text: text.optional(), size: size.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });
