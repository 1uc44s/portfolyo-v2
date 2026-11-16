// US-25, FR-LNK — link formu: görsel + başlık + URL zorunlu; başlık tekrarı serbest; yalnızca http/https.
// Oluşturma multipart (alanlar metin gelir); güncelleme JSON.
import { z } from 'zod';
import { httpUrl } from './url.js';

export const LINK_TITLE_MAX = 80;

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

const title = z
  .string({ error: 'Başlık zorunlu.' })
  .transform((v) => v.replace(CONTROL_CHARS, '').trim())
  .pipe(
    z
      .string()
      .min(1, 'Başlık zorunlu.')
      .max(LINK_TITLE_MAX, `Başlık en fazla ${LINK_TITLE_MAX} karakter olabilir.`),
  );

const url = z
  .string({ error: 'Bağlantı zorunlu.' })
  .trim()
  .min(1, 'Bağlantı zorunlu.')
  .pipe(httpUrl());

const flag = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')], {
  error: 'Açık/kapalı değeri geçersiz.',
});

export const linkCreateSchema = z.object({ title, url, isActive: flag.optional() }).strict();

export const linkUpdateSchema = z
  .object({ title: title.optional(), url: url.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });
