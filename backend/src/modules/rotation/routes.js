// /api/admin/rotation (settings:*).
import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import * as rotation from './service.js';

const params = z.object({ category: z.enum(rotation.ROTATION_CATEGORIES) }).strict();
const overrideBody = z.object({ contentId: z.number().int().positive() }).strict();

export function rotationRoutes() {
  const router = Router();
  const ctx = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', requirePermission('settings:read'), async (_req, res) => {
    res.json({ data: await rotation.getRotationOverview() });
  });

  router.put(
    '/:category/override',
    requirePermission('settings:write'),
    validate({ params, body: overrideBody }),
    async (req, res) => {
      const { category } = req.valid.params;
      await rotation.setOverride(category, req.valid.body.contentId, ctx(req));
      res.json({ data: await rotation.getRotationOverview() });
    },
  );

  router.delete(
    '/:category/override',
    requirePermission('settings:write'),
    validate({ params }),
    async (req, res) => {
      await rotation.clearOverride(req.valid.params.category, ctx(req));
      res.json({ data: await rotation.getRotationOverview() });
    },
  );

  router.post(
    '/:category/reselect',
    requirePermission('settings:write'),
    validate({ params }),
    async (req, res) => {
      await rotation.reselect(req.valid.params.category, ctx(req));
      res.json({ data: await rotation.getRotationOverview() });
    },
  );

  return router;
}
