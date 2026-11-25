// Çerez izni, analitik olayları,
// Dashboard sorgusu, yasal metin düzenleme.
import { z } from 'zod';

export const consentSchema = z
  .object({
    consentId: z.uuid().optional(),
    version: z.number().int().min(1).max(100_000),
    analytics: z.boolean(),
  })
  .strict();

export const ANALYTICS_EVENT_TYPES = Object.freeze(['PAGE_VIEW', 'PROJECT_VIEW']);

export const analyticsEventSchema = z
  .object({
    type: z.enum(ANALYTICS_EVENT_TYPES),
    path: z
      .string()
      .max(200)
      .regex(/^\/[^\s]*$/, 'Geçersiz yol.')
      .refine((p) => !p.startsWith('/admin'), 'Admin sayfaları sayılmaz.'),
    projectSlug: z.string().max(120).optional(),
  })
  .strict()
  .refine((v) => v.type !== 'PROJECT_VIEW' || Boolean(v.projectSlug), {
    message: 'Proje görüntülemesi için proje gerekli.',
    path: ['projectSlug'],
  });

export const DASHBOARD_RANGES = Object.freeze({ '7d': 7, '30d': 30, '90d': 90 });

export const dashboardQuerySchema = z
  .object({ range: z.enum(Object.keys(DASHBOARD_RANGES)).default('30d') })
  .strict();

export const LEGAL_DOC_SLUGS = Object.freeze(['kvkk-notice', 'cookie-policy']);
export const LEGAL_BODY_MAX = 50_000;

export const legalUpdateSchema = z
  .object({
    title: z
      .string({ error: 'Başlık zorunlu.' })
      .trim()
      .min(1, 'Başlık zorunlu.')
      .max(120, 'Başlık en fazla 120 karakter olabilir.'),
    bodyMarkdown: z
      .string({ error: 'Metin zorunlu.' })
      .trim()
      .min(1, 'Metin zorunlu.')
      .max(LEGAL_BODY_MAX, `Metin en fazla ${LEGAL_BODY_MAX} karakter olabilir.`),
    bumpVersion: z.boolean().default(false),
  })
  .strict();
