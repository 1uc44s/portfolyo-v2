// ROUTES.md §4.9 — /api/admin/categories (`categories:*`).
import { Router } from 'express';
import { z } from 'zod';
import {
  categoryCreateSchema,
  categoryReassignSchema,
  categoryUpdateSchema,
  reorderSchema,
} from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import * as categories from './service.js';

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();

export function categoryRoutes() {
  const router = Router();
  const read = requirePermission('categories:read');
  const write = requirePermission('categories:write');
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, async (_req, res) => {
    res.json({ data: await categories.listCategories() });
  });

  router.post('/', write, validate({ body: categoryCreateSchema }), async (req, res) => {
    res.status(201).json({ data: await categories.createCategory(req.valid.body, base(req)) });
  });

  router.patch('/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
    await categories.reorderCategories(req.valid.body.ids, base(req));
    res.status(204).end();
  });

  router.patch(
    '/:id',
    write,
    validate({ params: idParams, body: categoryUpdateSchema }),
    async (req, res) => {
      const { id } = req.valid.params;
      res.json({ data: await categories.updateCategory(id, req.valid.body, base(req)) });
    },
  );

  router.delete('/:id', write, validate({ params: idParams }), async (req, res) => {
    await categories.deleteCategory(req.valid.params.id, base(req));
    res.status(204).end();
  });

  router.post(
    '/:id/reassign-and-delete',
    write,
    validate({ params: idParams, body: categoryReassignSchema }),
    async (req, res) => {
      const result = await categories.reassignAndDelete(
        req.valid.params.id,
        req.valid.body.targetCategoryId,
        base(req),
      );
      res.json({ data: result });
    },
  );

  return router;
}
