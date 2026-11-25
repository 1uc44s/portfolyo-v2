// Tech Stack bölümleri ("My Tech Stack", "My Security Skill"…),
// başlıkları ve öğeleri (istemci + sunucu aynı şema).
import { z } from 'zod';

export const TECH_STACK_LIMITS = Object.freeze({
  minItems: 3,
  maxItems: 9,
  maxGroups: 6,
  label: 40,
  description: 2000,
  titleTop: 20,
  titleMain: 40,
  titleBottom: 40,
});

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const INLINE_CONTROL = /[\u0000-\u001F\u007F]/g;
// eslint-disable-next-line no-control-regex -- satır sonu korunur
const BLOCK_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const inline = (max, required) =>
  z
    .string()
    .transform((v) => v.replace(INLINE_CONTROL, ' ').replace(/\s+/g, ' ').trim())
    .pipe(
      required
        ? z.string().min(1, required).max(max, `En fazla ${max} karakter.`)
        : z.string().max(max, `En fazla ${max} karakter.`),
    );

const description = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, '\n').replace(BLOCK_CONTROL, '').trim())
  .pipe(
    z
      .string()
      .max(
        TECH_STACK_LIMITS.description,
        `Açıklama en fazla ${TECH_STACK_LIMITS.description} karakter olabilir.`,
      ),
  );

const flag = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

/** Yeni bölüm eklerken önerilen başlık ("My Security Skill"). */
export const TECH_STACK_GROUP_DEFAULTS = Object.freeze({
  titleTop: 'My',
  titleMain: 'Security',
  titleBottom: 'Skill',
});

const groupTitles = {
  titleTop: inline(TECH_STACK_LIMITS.titleTop),
  titleMain: inline(TECH_STACK_LIMITS.titleMain, 'Ana başlık zorunlu.'),
  titleBottom: inline(TECH_STACK_LIMITS.titleBottom),
};

/** Bölüm oluşturma: başlık verilmezse varsayılan "My Security Skill"; yayında değil başlar. */
export const techStackGroupCreateSchema = z
  .object({
    titleTop: groupTitles.titleTop.optional().default(TECH_STACK_GROUP_DEFAULTS.titleTop),
    titleMain: groupTitles.titleMain.optional().default(TECH_STACK_GROUP_DEFAULTS.titleMain),
    titleBottom: groupTitles.titleBottom.optional().default(TECH_STACK_GROUP_DEFAULTS.titleBottom),
  })
  .strict();

/** Bölüm ayarları: yayın + üç satırlık başlık. */
export const techStackGroupUpdateSchema = z
  .object({ published: z.boolean(), ...groupTitles })
  .strict();

/** Oluşturma multipart (alanlar metin gelir); görsel opsiyonel. */
export const techStackItemCreateSchema = z
  .object({
    label: inline(TECH_STACK_LIMITS.label, 'Etiket zorunlu.'),
    description: description.optional().default(''),
    isActive: flag.optional(),
  })
  .strict();

export const techStackItemUpdateSchema = z
  .object({
    label: inline(TECH_STACK_LIMITS.label, 'Etiket zorunlu.').optional(),
    description: description.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });
