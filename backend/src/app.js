// ARCHITECTURE.md §3 — middleware zinciri. listen() burada yok (test edilebilirlik).
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './modules/health/routes.js';
import { originCheck } from './middleware/originCheck.js';
import { noStore } from './middleware/noStore.js';
import { createRateLimiters, rateLimit } from './middleware/rateLimit.js';
import { passwordGate, requireAuth } from './middleware/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { accountRoutes } from './modules/account/routes.js';
import { heroRoutes, settingsRoutes } from './modules/settings/routes.js';
import { publicRoutes } from './modules/public/routes.js';
import { categoryRoutes } from './modules/categories/routes.js';
import { projectRoutes } from './modules/projects/routes.js';
import { linkRoutes } from './modules/links/routes.js';
import { contactMessageRoutes } from './modules/contact/routes.js';
import { integrationRoutes, spotifyCallbackRoutes } from './modules/integrations/routes.js';
import { dashboardRoutes } from './modules/analytics/routes.js';
import { systemRoutes } from './modules/system/routes.js';
import { techStackRoutes } from './modules/techstack/routes.js';
import { fallingRoutes } from './modules/falling/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { rotationRoutes } from './modules/rotation/routes.js';
import { contentRoutes } from './modules/content/routes.js';
import { mediaServeRoutes } from './modules/media/serve.js';
import { auditRoutes } from './modules/audit/routes.js';

/**
 * @param {{
 *   readinessCheck?: () => Promise<void>,
 *   rateLimitOverrides?: Record<string, { points: number, duration: number }>,
 * }} [deps]
 */
export function createApp({ readinessCheck = async () => {}, rateLimitOverrides } = {}) {
  const app = express();
  const limiters = createRateLimiters(rateLimitOverrides);

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use(securityHeaders);
  // Medya sunumu compression'dan önce: Range yanıtları sıkıştırılmamalı (ROUTES.md §3).
  app.use('/media', mediaServeRoutes());
  if (env.CORS_ORIGINS.length > 0) {
    app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  }
  // SSE (canlı durum) sıkıştırılmaz: olaylar anında gitmeli.
  app.use(
    compression({
      filter: (req, res) =>
        !String(res.getHeader('Content-Type') ?? '').includes('text/event-stream') &&
        compression.filter(req, res),
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(originCheck([env.PUBLIC_ORIGIN, ...env.CORS_ORIGINS]));

  app.use('/api', healthRoutes({ readinessCheck }));
  app.use('/api/public', publicRoutes({ limiters }));

  // ROUTES.md §1 — /api/admin: L1/L2 (auth) → L3 (requireAuth + passwordGate) → L4/L5 (modül içinde).
  const admin = express.Router();
  admin.use(noStore);
  admin.use('/auth', authRoutes({ limiters }));
  // Spotify OAuth dönüşü tarayıcı yönlendirmesi: Bearer yok, imzalı state cookie ile korunur.
  admin.use('/integrations/spotify/callback', spotifyCallbackRoutes());
  admin.use(
    requireAuth,
    rateLimit(limiters.adminApi, (req) => req.admin.id),
    passwordGate,
  );
  admin.use('/account', accountRoutes());
  admin.use('/settings', settingsRoutes({ limiters }));
  admin.use('/media', mediaRoutes(), contentRoutes({ limiters }));
  admin.use('/hero', heroRoutes());
  admin.use('/rotation', rotationRoutes());
  admin.use('/categories', categoryRoutes());
  admin.use('/projects', projectRoutes({ limiters }));
  admin.use('/links', linkRoutes({ limiters }));
  admin.use('/contact-messages', contactMessageRoutes());
  admin.use('/integrations', integrationRoutes());
  admin.use('/dashboard', dashboardRoutes());
  admin.use('/system', systemRoutes());
  admin.use('/tech-stack', techStackRoutes({ limiters }));
  admin.use('/falling-items', fallingRoutes({ limiters }));
  admin.use('/audit-logs', auditRoutes());
  app.use('/api/admin', admin);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
