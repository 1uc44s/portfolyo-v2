// public uçlar (L0). Yalnızca public alanlar döner.
import { Router } from 'express';
import { z } from 'zod';
import {
  analyticsEventSchema,
  CARD_THEMES,
  consentSchema,
  contactSchema,
  GITHUB_CARDS,
  INTEGRATION_SLUGS,
  isHoneypotFilled,
  SLUG_PATTERN,
} from '@my-portfolyo/shared';
import { NotFoundError } from '../../lib/httpError.js';
import { consume, rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { listDownloadable, MAX_PAGE_SIZE, PAGE_SIZE, sendDownload } from './downloads.js';
import { getPublicProject, listPublicCategories, listPublicProjects } from './projects.js';
import { listPublicLinks } from '../links/service.js';
import { assertCaptcha, finalizeContact, storeContact } from '../contact/service.js';
import { getPublicLegal, LEGAL_SLUGS } from './legal.js';
import { getPublicStatus, githubUsernameIfEnabled } from '../integrations/service.js';
import { getCard } from '../integrations/providers/github.js';
import { streamStatus } from '../integrations/live.js';
import { recordConsent, recordEvent } from '../analytics/service.js';
import { getPublicTechStack } from '../techstack/service.js';
import { getPublicSite } from './site.js';

const listQuery = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(PAGE_SIZE),
});
const projectsQuery = z
  .object({ category: z.coerce.number().int().positive().optional() })
  .strict();
const slugParams = z.object({ slug: z.string().regex(SLUG_PATTERN).max(120) });
const downloadParams = z.object({
  target: z.enum(['wallpaper', 'pfp']),
  publicId: z.string().regex(/^[a-z0-9]{20,40}$/),
});

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function publicRoutes({ limiters }) {
  const router = Router();
  router.use(rateLimit(limiters.publicGlobal));

  router.get('/site', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json({ data: await getPublicSite() });
  });

  // yayındaki projeler, detay (yoksa 404) ve filtre kategorileri.
  const cached = (res) => res.set('Cache-Control', 'public, max-age=30');
  router.get('/projects', validate({ query: projectsQuery }), async (req, res) => {
    cached(res).json({ data: await listPublicProjects(req.valid.query) });
  });
  router.get('/projects/:slug', async (req, res) => {
    const parsed = slugParams.safeParse(req.params);
    if (!parsed.success) throw new NotFoundError('Proje bulunamadı.');
    cached(res).json({ data: await getPublicProject(parsed.data.slug) });
  });
  // aktif linkler (boşsa []).
  router.get('/links', async (_req, res) => {
    cached(res).json({ data: await listPublicLinks() });
  });
  router.get('/categories', async (_req, res) => {
    cached(res).json({ data: await listPublicCategories() });
  });

  // keyset, id ASC, sayfa 24.
  for (const [path, target] of [
    ['/wallpapers', 'wallpaper'],
    ['/pfps', 'pfp'],
  ]) {
    router.get(path, validate({ query: listQuery }), async (req, res) => {
      const { items, nextCursor } = await listDownloadable(target, req.valid.query);
      res.set('Cache-Control', 'public, max-age=30');
      res.json({ data: items, meta: { nextCursor } });
    });
  }

  // IP başına 30 / 10 dk. Geçersiz parametre de 404 (ifşa yok).
  router.get('/downloads/:target/:publicId', rateLimit(limiters.download), async (req, res) => {
    const parsed = downloadParams.safeParse(req.params);
    if (!parsed.success) throw new NotFoundError();
    return sendDownload(req, res, parsed.data.target, parsed.data.publicId);
  });

  // durum snapshot'ları (dış API çağrısı yok). Kapalıysa { enabled:false }.
  router.get('/status/:provider', async (req, res) => {
    if (!INTEGRATION_SLUGS.includes(req.params.provider)) throw new NotFoundError();
    res.set('Cache-Control', 'public, max-age=15');
    res.json({ data: await getPublicStatus(req.params.provider) });
  });

  // canlı durum akışı (SSE): snapshot değişince anında gönderilir.
  router.get('/status/:provider/stream', async (req, res) => {
    if (!INTEGRATION_SLUGS.includes(req.params.provider)) throw new NotFoundError();
    await streamStatus(req, res, req.params.provider, getPublicStatus);
  });

  // istatistik kartı proxy'si. SVG <img> ile gösterilir; script çalışamaz.
  router.get('/status/github/cards/:file', async (req, res) => {
    const match = /^(stats|streak)\.svg$/.exec(req.params.file);
    const card = match?.[1];
    if (!card || !GITHUB_CARDS.includes(card)) throw new NotFoundError();
    const theme = CARD_THEMES.includes(req.query.theme) ? req.query.theme : 'dark';
    const username = await githubUsernameIfEnabled();
    if (!username) throw new NotFoundError();
    const { svg, fallback } = await getCard(card, theme, username);
    res.set({
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': fallback ? 'public, max-age=300' : 'public, max-age=21600',
    });
    res.send(svg);
  });

  // Tech Stack (yayında değilse { published:false }).
  router.get('/tech-stack', async (_req, res) => {
    cached(res).json({ data: await getPublicTechStack() });
  });

  // anonim izin kaydı (IP saklanmaz).
  router.post(
    '/consent',
    rateLimit(limiters.consent),
    validate({ body: consentSchema }),
    async (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({ data: await recordConsent(req.valid.body) });
    },
  );

  // yalnızca izin veren istemci çağırır.
  router.post(
    '/analytics/events',
    rateLimit(limiters.analytics),
    validate({ body: analyticsEventSchema }),
    async (req, res) => {
      await recordEvent(req.valid.body, req);
      res.status(204).end();
    },
  );

  // yasal metinler (KVKK aydınlatma, çerez politikası).
  router.get('/legal/:key', async (req, res) => {
    const key = Object.hasOwn(LEGAL_SLUGS, req.params.key) ? LEGAL_SLUGS[req.params.key] : null;
    if (!key) throw new NotFoundError('Metin bulunamadı.');
    cached(res).json({ data: await getPublicLegal(key) });
  });

  // sıra: honeypot → şema → rate limit → Turnstile → kayıt.
  // Honeypot ve başarı aynı yanıtı döner (bot ayırt edemez).
  router.post('/contact', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (isHoneypotFilled(req.body)) return res.json({ data: { ok: true } });
    const parsed = contactSchema.parse(req.body ?? {});
    const data = finalizeContact(parsed);
    await consume(limiters.contact10m, req.ip);
    await consume(limiters.contactDay, req.ip);
    await assertCaptcha(parsed.turnstileToken, req.ip);
    await storeContact(data, { ip: req.ip, userAgent: req.get('user-agent') });
    return res.json({ data: { ok: true } });
  });

  return router;
}
