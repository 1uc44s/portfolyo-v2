// ROUTES.md §4.7b — /api/admin/falling-items (`hero:*`). Görseller FALLING_IMAGE hattından.
import { Router } from 'express';
import { z } from 'zod';
import { fallingItemCreateSchema, fallingItemUpdateSchema, reorderSchema } from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { upload } from '../media/upload.js';
import * as falling from './service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function fallingRoutes({ limiters }) {
  const router = Router();
  const read = requirePermission('hero:read');
  const write = requirePermission('hero:write');
  const uploadLimit = rateLimit(limiters.upload, (req) => req.admin.id);
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, async (_req, res) => {
    res.json({ data: await falling.listFallingItems() });
  });

  router.post(
    '/',
    write,
    uploadLimit,
    upload('FALLING_IMAGE', 'image', { optional: true }),
    validate({ body: fallingItemCreateSchema }),
    async (req, res) => {
      const { item, duplicateOf } = await falling.createItem(
        req.valid.body,
        req.file ?? null,
        base(req),
      );
      res.status(201).json({ data: item, meta: { duplicateOf } });
    },
  );

  router.patch('/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
    await falling.reorderItems(req.valid.body.ids, base(req));
    res.status(204).end();
  });

  router.patch(
    '/:id',
    write,
    validate({ params: idParams, body: fallingItemUpdateSchema }),
    async (req, res) => {
      res.json({ data: await falling.updateItem(req.valid.params.id, req.valid.body, base(req)) });
    },
  );

  router.put(
    '/:id/image',
    write,
    uploadLimit,
    validate({ params: idParams }),
    upload('FALLING_IMAGE', 'image'),
    async (req, res) => {
      const { item, duplicateOf } = await falling.replaceImage(
        req.valid.params.id,
        req.file,
        base(req),
      );
      res.json({ data: item, meta: { duplicateOf } });
    },
  );

  router.delete('/:id', write, validate({ params: idParams }), async (req, res) => {
    await falling.deleteItem(req.valid.params.id, base(req));
    res.status(204).end();
  });

  return router;
}
