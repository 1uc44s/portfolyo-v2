// ARCHITECTURE.md §10 — ortam değişkenleri Zod ile doğrulanır; geçersizse süreç başlamaz.
// Değişkenler faz faz eklenir; şu an F6 kapsamı.
import { z } from 'zod';

const secret = (name, minLength) =>
  z
    .string({ error: `${name} tanımlı değil.` })
    .min(minLength, `${name} en az ${minLength} karakter olmalı (rastgele üret).`)
    .refine((v) => !/change_?me/i.test(v), `${name} örnek değer olamaz.`);

const encryptionKey = z
  .string({ error: 'APP_ENCRYPTION_KEY tanımlı değil.' })
  .refine(
    (v) => Buffer.from(v, 'base64').length === 32,
    'APP_ENCRYPTION_KEY base64 kodlu tam 32 byte olmalı.',
  );

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PUBLIC_ORIGIN: z.url().default('http://localhost:5173'),
  CORS_ORIGINS: csv,
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL bir PostgreSQL bağlantı adresi olmalı.'),
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET', 64),
  CSRF_SECRET: secret('CSRF_SECRET', 43),
  APP_ENCRYPTION_KEY: encryptionKey,
  // F6 — medya hattı (ARCHITECTURE.md §8). S3 sürücüsü v1'de iskelet.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_ROOT: z.string().min(1).default('./uploads'),
  // Link önizlemesi: SPA HTML'i API'den, sayfa başına meta etiketleriyle (modules/seo). Boşsa kapalı.
  FRONTEND_DIST: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().optional()),
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
  // F14 — Cloudflare Turnstile (FR-CNT-05). Prod'da zorunlu; dev/test'te boşsa resmi test anahtarları.
  TURNSTILE_SITE_KEY: z.string().trim().optional(),
  TURNSTILE_SECRET_KEY: z.string().trim().optional(),
  // F15 — GitHub (FR-INT-G). Token opsiyonel (rate limit); kart servisleri sabit host listesi.
  GITHUB_TOKEN: z.string().trim().optional(),
  GITHUB_STATS_BASE_URL: z.url().default('https://github-readme-stats.vercel.app'),
  GITHUB_STREAK_BASE_URL: z.url().default('https://streak-stats.demolab.com'),
});

// Cloudflare'in yayımladığı, her zaman geçen test anahtarları (gizli değildir).
export const TURNSTILE_TEST_KEYS = Object.freeze({
  siteKey: '1x00000000000000000000AA',
  secretKey: '1x0000000000000000000000000000000AA',
});

const withDefaults = schema
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== 'production') return;
    for (const name of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
      if (!v[name]) {
        ctx.addIssue({ code: 'custom', path: [name], message: `${name} prod'da zorunlu.` });
      }
    }
  })
  .transform((v) => ({
    ...v,
    TURNSTILE_SITE_KEY: v.TURNSTILE_SITE_KEY || TURNSTILE_TEST_KEYS.siteKey,
    TURNSTILE_SECRET_KEY: v.TURNSTILE_SECRET_KEY || TURNSTILE_TEST_KEYS.secretKey,
  }));

/** @param {Record<string, string | undefined>} source */
export function loadEnv(source = process.env) {
  const parsed = withDefaults.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Geçersiz ortam değişkenleri:\n${issues}`);
  }
  return Object.freeze(parsed.data);
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
