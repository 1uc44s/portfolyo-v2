// ROUTES.md §4.10 — /api/admin/links (`links:*`). Oluşturma multipart `image` + alanlar.
import { Router } from 'express';
import { z } from 'zod';
import { linkCreateSchema, linkUpdateSchema, reorderSchema } from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { upload } from '../media/upload.js';
import * as links from './service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function linkRoutes({ limiters }) {
  const router = Router();
  const read = requirePermission('links:read');
  const write = requirePermission('links:write');
  const uploadLimit = rateLimit(limiters.upload, (req) => req.admin.id);
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, async (_req, res) => {
    res.json({ data: await links.listLinks() });
  });

  router.post(
    '/',
    write,
    uploadLimit,
    upload('LINK_IMAGE', 'image'),
    validate({ body: linkCreateSchema }),
    async (req, res) => {
      const { link, duplicateOf } = await links.createLink(req.valid.body, req.file, base(req));
      res.status(201).json({ data: link, meta: { duplicateOf } });
    },
  );

  router.patch('/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
    await links.reorderLinks(req.valid.body.ids, base(req));
    res.status(204).end();
  });

  router.patch(
    '/:id',
    write,
    validate({ params: idParams, body: linkUpdateSchema }),
    async (req, res) => {
      res.json({ data: await links.updateLink(req.valid.params.id, req.valid.body, base(req)) });
    },
  );

  router.put(
    '/:id/image',
    write,
    uploadLimit,
    validate({ params: idParams }),
    upload('LINK_IMAGE', 'image'),
    async (req, res) => {
      const { link, duplicateOf } = await links.replaceImage(
        req.valid.params.id,
        req.file,
        base(req),
      );
      res.json({ data: link, meta: { duplicateOf } });
    },
  );

  router.delete('/:id', write, validate({ params: idParams }), async (req, res) => {
    await links.deleteLink(req.valid.params.id, base(req));
    res.status(204).end();
  });

  return router;
}
