// /api/admin/settings (settings:*) ve hero (hero:*).
import { Router } from 'express';
import { aboutSchema, heroSchema, siteSettingsSchema } from '@my-portfolyo/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { upload } from '../media/upload.js';
import * as settings from './service.js';

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function settingsRoutes({ limiters }) {
  const router = Router();

  router.get('/', requirePermission('settings:read'), async (_req, res) => {
    res.json({ data: await settings.getSettings() });
  });

  router.patch(
    '/',
    requirePermission('settings:write'),
    validate({ body: siteSettingsSchema }),
    async (req, res) => {
      res.json({
        data: await settings.updateSiteSettings(req.admin.id, req.valid.body, requestContext(req)),
      });
    },
  );

  // Favicon: FAVICON medya hattı (ico/png, ≤ 512×512, ≤ 1 MB).
  router.put(
    '/favicon',
    requirePermission('settings:write'),
    rateLimit(limiters.upload, (req) => req.admin.id),
    upload('FAVICON'),
    async (req, res) => {
      const { settings: data, duplicateOf } = await settings.setFavicon(
        req.admin.id,
        req.file,
        requestContext(req),
      );
      res.json({ data, meta: { duplicateOf } });
    },
  );

  router.delete('/favicon', requirePermission('settings:write'), async (req, res) => {
    res.json({ data: await settings.clearFavicon(req.admin.id, requestContext(req)) });
  });

  router.put(
    '/about',
    requirePermission('settings:write'),
    validate({ body: aboutSchema }),
    async (req, res) => {
      res.json({
        data: await settings.updateAbout(req.admin.id, req.valid.body, requestContext(req)),
      });
    },
  );

  return router;
}

export function heroRoutes() {
  const router = Router();

  router.get('/', requirePermission('hero:read'), async (_req, res) => {
    res.json({ data: await settings.getHero() });
  });

  // sabit profil seçimi için aktif profil medyası (hero:read yeterli; media:read gerekmez).
  router.get('/profile-options', requirePermission('hero:read'), async (_req, res) => {
    res.json({ data: await settings.listProfileOptions() });
  });

  router.put(
    '/',
    requirePermission('hero:write'),
    validate({ body: heroSchema }),
    async (req, res) => {
      res.json({
        data: await settings.updateHero(req.admin.id, req.valid.body, requestContext(req)),
      });
    },
  );

  return router;
}
