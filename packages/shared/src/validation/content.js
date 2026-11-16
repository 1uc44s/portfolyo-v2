// CMS.md §1, §9 — Site Ayarları, Hakkımda ve Hero formları (istemci + sunucu aynı şema).
import { z } from 'zod';

// 2026-11-16: PARTICLES/STARS kaldırıldı; GRADIENT (hareketsiz) ve GRADIENT_ANIMATED aynı iki rengi kullanır.
export const NAME_EFFECTS = Object.freeze(['NEON', 'GRADIENT', 'GRADIENT_ANIMATED', 'OVERLAY']);
export const HERO_GRADIENT_DEFAULTS = Object.freeze({ from: '#a78bfa', to: '#f472b6' });
const hexColor = z
  .string({ error: 'Renk zorunlu.' })
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Renk #RRGGBB biçiminde olmalı.')
  .transform((v) => v.toLowerCase());
export const PROFILE_MODES = Object.freeze(['ROTATION', 'FIXED']);
export const ABOUT_MAX_LENGTH = 20_000;
export const FOOTER_TECHS_MAX = 20;

/** React Icons paket önekleri (react-icons 5.x). */
export const REACT_ICON_PACKS = Object.freeze([
  'Ai',
  'Bi',
  'Bs',
  'Cg',
  'Ci',
  'Di',
  'Fa',
  'Fa6',
  'Fc',
  'Fi',
  'Gi',
  'Go',
  'Gr',
  'Hi',
  'Hi2',
  'Im',
  'Io',
  'Io5',
  'Lia',
  'Lu',
  'Md',
  'Pi',
  'Ri',
  'Rx',
  'Si',
  'Sl',
  'Tb',
  'Tfi',
  'Ti',
  'Vsc',
  'Wi',
]);
const REACT_ICON_NAME = new RegExp(`^(?:${REACT_ICON_PACKS.join('|')})[A-Z0-9][A-Za-z0-9]{0,60}$`);
const ICON_MESSAGE = 'İkon React Icons adı olmalı (ör. SiReact, FaGithub).';

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Tek satırlık metin: kırpılır, kontrol karakterleri atılır. */
const line = (max, message) =>
  z
    .string()
    .transform((v) => v.replace(CONTROL_CHARS, '').trim())
    .pipe(z.string().max(max, message));

/** Boş metni null'a çevirir (opsiyonel alanlar). */
const optionalLine = (max, message) =>
  z.union([line(max, message), z.null()]).transform((v) => (v ? v : null));

export const footerTechSchema = z
  .object({
    label: line(40, 'Etiket en fazla 40 karakter olabilir.').pipe(
      z.string().min(1, 'Etiket zorunlu.'),
    ),
    // React Icons bileşen adı (https://react-icons.github.io/react-icons, ör. SiReact, FaGithub).
    // Boş → null.
    icon: z
      .union([z.string(), z.null()])
      .optional()
      .transform((v) => (typeof v === 'string' ? v.trim() : null) || null)
      .pipe(z.string().regex(REACT_ICON_NAME, ICON_MESSAGE).nullable()),
  })
  .strict();

export const siteSettingsSchema = z
  .object({
    navbarTitle: line(40, 'Başlık en fazla 40 karakter olabilir.')
      .pipe(z.string().min(1, 'Navbar başlığı zorunlu.'))
      .optional(),
    footerTechs: z
      .array(footerTechSchema)
      .max(FOOTER_TECHS_MAX, `En fazla ${FOOTER_TECHS_MAX} teknoloji eklenebilir.`)
      .optional(),
  })
  .strict()
  .refine((v) => v.navbarTitle !== undefined || v.footerTechs !== undefined, {
    message: 'Değiştirilecek bir alan gönderilmedi.',
  });

export const aboutSchema = z
  .object({
    title: line(80, 'Başlık en fazla 80 karakter olabilir.').pipe(
      z.string().min(1, 'Başlık zorunlu.'),
    ),
    bodyMarkdown: z
      .string()
      .transform((v) => v.replace(CONTROL_CHARS, ''))
      .pipe(z.string().max(ABOUT_MAX_LENGTH, 'İçerik en fazla 20.000 karakter olabilir.')),
  })
  .strict();

export const heroSchema = z
  .object({
    displayName: line(60, 'İsim en fazla 60 karakter olabilir.').pipe(
      z.string().min(1, 'İsim zorunlu.'),
    ),
    tagline: optionalLine(160, 'Slogan en fazla 160 karakter olabilir.'),
    location: optionalLine(80, 'Konum en fazla 80 karakter olabilir.'),
    nameEffects: z
      .array(z.enum(NAME_EFFECTS))
      .max(4)
      .refine((v) => new Set(v).size === v.length, 'Aynı efekt iki kez seçilemez.')
      .refine(
        (v) => !(v.includes('GRADIENT') && v.includes('GRADIENT_ANIMATED')),
        'Hareketli ve hareketsiz gradyan birlikte seçilemez.',
      ),
    // Eski istemciler göndermeyebilir: verilmezse mevcut renk korunur.
    gradientFrom: hexColor.optional(),
    gradientTo: hexColor.optional(),
    profileMode: z.enum(PROFILE_MODES),
    fixedProfileMediaId: z.number().int().positive().nullable(),
  })
  .strict()
  .refine((v) => v.profileMode !== 'FIXED' || v.fixedProfileMediaId !== null, {
    message: 'Sabit profil için bir görsel seçmelisin.',
    path: ['fixedProfileMediaId'],
  });
