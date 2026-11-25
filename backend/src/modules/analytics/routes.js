// /api/admin/dashboard (`dashboard:read`).
import { Router } from 'express';
import { DASHBOARD_RANGES, dashboardQuerySchema } from '@my-portfolyo/shared';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { dashboardSummary } from './service.js';

export function dashboardRoutes() {
  const router = Router();
  router.get(
    '/summary',
    requirePermission('dashboard:read'),
    validate({ query: dashboardQuerySchema }),
    async (req, res) => {
      const days = DASHBOARD_RANGES[req.valid.query.range];
      res.json({ data: await dashboardSummary(req.admin, days) });
    },
  );
  return router;
}
