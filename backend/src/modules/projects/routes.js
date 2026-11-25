// /api/admin/projects (`projects:*`). Görseller multipart `files[]` (≤ 10/istek).
import { Router } from 'express';
import { z } from 'zod';
import {
  PROJECT_IMAGES_PER_REQUEST,
  projectCreateSchema,
  projectImageUpdateSchema,
  projectUpdateSchema,
  reorderSchema,
} from '@my-portfolyo/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { uploadMany } from '../media/upload.js';
import * as projects from './service.js';

const id = z.coerce.number().int().positive();
const idParams = z.object({ id }).strict();
const imageParams = z.object({ id, imageId: id }).strict();
const listQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    isPublished: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    categoryId: id.optional(),
    sort: z
      .string()
      .regex(/^(title|createdAt|updatedAt|sortOrder|viewCount):(asc|desc)$/)
      .optional(),
  })
  .strict();
const slugQuery = z
  .object({ slug: z.string().trim().min(1).max(200), excludeId: id.optional() })
  .strict();

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function projectRoutes({ limiters }) {
  const router = Router();
  const read = requirePermission('projects:read');
  const write = requirePermission('projects:write');
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, validate({ query: listQuery }), async (req, res) => {
    res.json({ data: await projects.listProjects(req.valid.query) });
  });

  router.get('/slug-check', read, validate({ query: slugQuery }), async (req, res) => {
    const { slug, excludeId } = req.valid.query;
    res.json({ data: await projects.slugCheck(slug, excludeId) });
  });

  router.patch('/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
    await projects.reorderProjects(req.valid.body.ids, base(req));
    res.status(204).end();
  });

  router.post('/', write, validate({ body: projectCreateSchema }), async (req, res) => {
    res.status(201).json({ data: await projects.createProject(req.valid.body, base(req)) });
  });

  router.get('/:id', read, validate({ params: idParams }), async (req, res) => {
    res.json({ data: await projects.getProject(req.valid.params.id) });
  });

  router.patch(
    '/:id',
    write,
    validate({ params: idParams, body: projectUpdateSchema }),
    async (req, res) => {
      res.json({
        data: await projects.updateProject(req.valid.params.id, req.valid.body, base(req)),
      });
    },
  );

  router.delete('/:id', write, validate({ params: idParams }), async (req, res) => {
    await projects.deleteProject(req.valid.params.id, base(req));
    res.status(204).end();
  });

  router.post(
    '/:id/images',
    write,
    rateLimit(limiters.upload, (req) => req.admin.id),
    validate({ params: idParams }),
    uploadMany('PROJECT_IMAGE', 'files', PROJECT_IMAGES_PER_REQUEST),
    async (req, res) => {
      const { project, duplicates } = await projects.addImages(
        req.valid.params.id,
        req.files,
        base(req),
      );
      res.status(201).json({ data: project, meta: { duplicates } });
    },
  );

  router.patch(
    '/:id/images/reorder',
    write,
    validate({ params: idParams, body: reorderSchema }),
    async (req, res) => {
      res.json({
        data: await projects.reorderImages(req.valid.params.id, req.valid.body.ids, base(req)),
      });
    },
  );

  router.patch(
    '/:id/images/:imageId',
    write,
    validate({ params: imageParams, body: projectImageUpdateSchema }),
    async (req, res) => {
      const { id: projectId, imageId } = req.valid.params;
      res.json({
        data: await projects.updateImage(projectId, imageId, req.valid.body, base(req)),
      });
    },
  );

  router.delete(
    '/:id/images/:imageId',
    write,
    validate({ params: imageParams }),
    async (req, res) => {
      const { id: projectId, imageId } = req.valid.params;
      res.json({ data: await projects.deleteImage(projectId, imageId, base(req)) });
    },
  );

  return router;
}
