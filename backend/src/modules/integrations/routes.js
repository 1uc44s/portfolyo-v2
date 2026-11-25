// /api/admin/integrations (`status:*`; secret ve Spotify bağlama L5).
// Spotify callback tarayıcı yönlendirmesiyle gelir (Bearer yok): ayrı router, requireAuth'tan önce;
// koruma imzalı, tek kullanımlık, 10 dk'lık `state` cookie'si (HMAC + adminId + exp).
import { Router } from 'express';
import { z } from 'zod';
import { INTEGRATION_SLUGS, integrationPatchSchema } from '@my-portfolyo/shared';
import { env } from '../../config/env.js';
import { hmacBase64Url, randomToken, safeEqual } from '../../lib/hash.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { requirePermission, requireSuper } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { AppError } from '../../lib/httpError.js';
import { publicErrorMessage } from './http.js';
import { authorizeUrl, exchangeCode } from './providers/spotify.js';
import * as integrations from './service.js';

const slugParams = z.object({ provider: z.enum(INTEGRATION_SLUGS) }).strict();
export const SPOTIFY_STATE_COOKIE = '__Host-sp_state';
const STATE_TTL_MS = 10 * 60_000;
// Spotify → bizim alan adı yönlendirmesi siteler arası üst düzey gezinti: Lax gerekir (Strict gönderilmez).
const stateCookie = { secure: true, sameSite: 'lax', path: '/', httpOnly: true };

const sign = (payload) => hmacBase64Url(env.CSRF_SECRET, `spotify-state:${payload}`);

export function createState(adminId, now = Date.now()) {
  const nonce = randomToken(24);
  const payload = Buffer.from(
    JSON.stringify({ a: adminId, n: nonce, e: now + STATE_TTL_MS }),
  ).toString('base64url');
  return { nonce, cookie: `${payload}.${sign(payload)}` };
}

/** @returns {{ adminId: string } | null} */
export function verifyState(cookie, nonce, now = Date.now()) {
  if (typeof cookie !== 'string' || typeof nonce !== 'string') return null;
  const [payload, mac] = cookie.split('.');
  if (!payload || !mac || !safeEqual(mac, sign(payload))) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.e !== 'number' || data.e < now) return null;
  if (!safeEqual(String(data.n), nonce)) return null;
  return { adminId: String(data.a) };
}

export function integrationRoutes() {
  const router = Router();
  const read = requirePermission('status:read');
  const write = requirePermission('status:write');
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, async (_req, res) => {
    res.json({ data: await integrations.listIntegrations() });
  });

  router.get('/spotify/authorize', requireSuper, async (req, res) => {
    const row = await integrations.getRow('spotify');
    const secrets = integrations.readSecrets(row);
    if (!row.config?.clientId || !secrets.clientSecret) {
      throw new AppError(409, 'NOT_CONFIGURED', 'Önce Client ID ve Client Secret kaydet.');
    }
    const { nonce, cookie } = createState(req.admin.id);
    res.cookie(SPOTIFY_STATE_COOKIE, cookie, { ...stateCookie, maxAge: STATE_TTL_MS });
    res.json({ data: { url: authorizeUrl(row.config.clientId, nonce) } });
  });

  router.delete('/spotify/connection', requireSuper, async (req, res) => {
    await integrations.disconnectSpotify(base(req));
    res.status(204).end();
  });

  router.patch(
    '/:provider',
    write,
    validate({ params: slugParams, body: integrationPatchSchema }),
    async (req, res) => {
      res.json({
        data: await integrations.updateIntegration(
          req.valid.params.provider,
          req.valid.body,
          base(req),
        ),
      });
    },
  );

  router.put(
    '/:provider/secrets',
    requireSuper,
    validate({ params: slugParams }),
    async (req, res) => {
      res.json({
        data: await integrations.setSecrets(req.valid.params.provider, req.body ?? {}, base(req)),
      });
    },
  );

  router.post('/:provider/test', write, validate({ params: slugParams }), async (req, res) => {
    res.json({ data: await integrations.testIntegration(req.valid.params.provider, base(req)) });
  });

  router.post('/:provider/sync', write, validate({ params: slugParams }), async (req, res) => {
    const slug = req.valid.params.provider;
    try {
      await integrations.syncNow(slug);
      res.json({ data: { ok: true, message: 'Güncellendi.' } });
    } catch (err) {
      res.json({ data: { ok: false, message: publicErrorMessage(err) } });
    }
  });

  return router;
}

/** Bearer'sız callback: /api/admin/integrations/spotify/callback. */
export function spotifyCallbackRoutes() {
  const router = Router();
  router.get('/', async (req, res) => {
    const done = (result) =>
      res.redirect(303, new URL(`/admin/status?spotify=${result}`, env.PUBLIC_ORIGIN).toString());
    const cookie = req.cookies?.[SPOTIFY_STATE_COOKIE];
    res.clearCookie(SPOTIFY_STATE_COOKIE, stateCookie);
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = verifyState(cookie, typeof req.query.state === 'string' ? req.query.state : '');
    if (!state) return done('invalid_state');
    if (!code) return done(req.query.error === 'access_denied' ? 'denied' : 'error');

    const admin = await prisma.adminUser.findUnique({ where: { id: state.adminId } });
    if (!admin || !admin.isActive || admin.role !== 'SUPER_ADMIN') return done('invalid_state');

    try {
      const row = await integrations.getRow('spotify');
      const secrets = integrations.readSecrets(row);
      const result = await exchangeCode({
        clientId: row.config?.clientId,
        clientSecret: secrets.clientSecret,
        code: code.slice(0, 2048),
      });
      await integrations.saveSpotifyConnection(result, {
        adminId: admin.id,
        ctx: requestContext(req),
      });
      return done('connected');
    } catch (err) {
      logger.warn({ error: publicErrorMessage(err) }, 'Spotify bağlantısı tamamlanamadı');
      return done('error');
    }
  });
  return router;
}
