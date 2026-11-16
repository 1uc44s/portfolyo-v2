// ROUTES.md §4.13 — /api/admin/tech-stack (`settings:*`). Görseller TECH_STACK_IMAGE hattından.
import { Router } from 'express';
import { z } from 'zod';
import {
  reorderSchema,
  techStackItemCreateSchema,
  techStackItemUpdateSchema,
  techStackSettingsSchema,
} from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { upload } from '../media/upload.js';
import * as techStack from './service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function techStackRoutes({ limiters }) {
  const router = Router();
  const read = requirePermission('settings:read');
  const write = requirePermission('settings:write');
  const uploadLimit = rateLimit(limiters.upload, (req) => req.admin.id);
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, async (_req, res) => {
    res.json({ data: await techStack.getTechStack() });
  });

  router.put('/settings', write, validate({ body: techStackSettingsSchema }), async (req, res) => {
    res.json({ data: await techStack.updateSettings(req.valid.body, base(req)) });
  });

  router.post(
    '/items',
    write,
    uploadLimit,
    upload('TECH_STACK_IMAGE', 'image', { optional: true }),
    validate({ body: techStackItemCreateSchema }),
    async (req, res) => {
      const { item, duplicateOf } = await techStack.createItem(
        req.valid.body,
        req.file ?? null,
        base(req),
      );
      res.status(201).json({ data: item, meta: { duplicateOf } });
    },
  );

  router.patch('/items/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
    await techStack.reorderItems(req.valid.body.ids, base(req));
    res.status(204).end();
  });

  router.patch(
    '/items/:id',
    write,
    validate({ params: idParams, body: techStackItemUpdateSchema }),
    async (req, res) => {
      res.json({
        data: await techStack.updateItem(req.valid.params.id, req.valid.body, base(req)),
      });
    },
  );

  router.put(
    '/items/:id/image',
    write,
    uploadLimit,
    validate({ params: idParams }),
    upload('TECH_STACK_IMAGE', 'image'),
    async (req, res) => {
      const { item, duplicateOf } = await techStack.replaceItemImage(
        req.valid.params.id,
        req.file,
        base(req),
      );
      res.json({ data: item, meta: { duplicateOf } });
    },
  );

  router.delete('/items/:id/image', write, validate({ params: idParams }), async (req, res) => {
    const { item } = await techStack.replaceItemImage(req.valid.params.id, null, base(req));
    res.json({ data: item });
  });

  router.delete('/items/:id', write, validate({ params: idParams }), async (req, res) => {
    await techStack.deleteItem(req.valid.params.id, base(req));
    res.status(204).end();
  });

  return router;
}
