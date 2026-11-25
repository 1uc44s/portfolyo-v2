// liveness ve readiness.
import { Router } from 'express';

/** @param {{ readinessCheck: () => Promise<void> }} deps */
export function healthRoutes({ readinessCheck }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ data: { ok: true } });
  });

  router.get('/ready', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await readinessCheck();
      res.json({ data: { ok: true } });
    } catch (err) {
      req.log?.warn({ err }, 'Readiness kontrolü başarısız');
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Servis hazır değil.', requestId: req.id },
      });
    }
  });

  return router;
}
