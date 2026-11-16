// ROUTES.md §4.6 — /api/admin/media/{backgrounds,musics,pfps,cursors} (`media:*`).
// Oluşturma/dosya değiştirme multipart (dosya yuvaları + düz alanlar); PATCH ve reorder JSON.
import { Router } from 'express';
import { z } from 'zod';
import {
  mediaCreateSchema,
  mediaReplaceSchema,
  mediaUpdateSchema,
  reorderSchema,
} from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import { uploadFields } from '../media/upload.js';
import * as content from './service.js';
import { CONTENT_TYPES } from './types.js';

const idParams = z.object({ id: z.coerce.number().int().positive() }).strict();
const boolQuery = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const listQuery = (def) =>
  z
    .object({
      q: z.string().trim().max(120).optional(),
      ...Object.fromEntries(def.flags.map((f) => [f, boolQuery])),
      type: z.enum(['IMAGE', 'ANIMATED_IMAGE', 'VIDEO', 'AUDIO', 'CURSOR']).optional(),
      status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
      sort: z
        .string()
        .regex(/^(title|createdAt|sortOrder):(asc|desc)$/)
        .optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
    })
    .strict();

/** Video asset'i kuyruğa alındıysa 202 (PENDING), aksi hâlde başarı kodu. */
const statusOf = (item, ok) => (item.status === 'READY' ? ok : 202);
const meta = (duplicates) => ({ duplicateOf: duplicates[0] ?? null, duplicates });

function typeRouter(def, { limiters }) {
  const router = Router();
  const write = requirePermission('media:write');
  const uploadLimit = rateLimit(limiters.upload, (req) => req.admin.id);
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get(
    '/',
    requirePermission('media:read'),
    validate({ query: listQuery(def) }),
    async (req, res) => {
      const { items, meta: page } = await content.listContent(def, req.valid.query);
      res.json({ data: items, meta: page });
    },
  );

  router.post(
    '/',
    write,
    uploadLimit,
    uploadFields(def.slots),
    validate({ body: mediaCreateSchema(def.type) }),
    async (req, res) => {
      const { item, duplicates } = await content.createContent(def, {
        ...base(req),
        files: req.slotFiles,
        input: req.valid.body,
      });
      res.status(statusOf(item, 201)).json({ data: item, meta: meta(duplicates) });
    },
  );

  if (def.sortable) {
    router.patch('/reorder', write, validate({ body: reorderSchema }), async (req, res) => {
      await content.reorderContent(def, req.valid.body.ids, base(req));
      res.status(204).end();
    });
  }

  router.get(
    '/:id',
    requirePermission('media:read'),
    validate({ params: idParams }),
    async (req, res) => {
      res.json({ data: await content.getContent(def, req.valid.params.id) });
    },
  );

  router.patch(
    '/:id',
    write,
    validate({ params: idParams, body: mediaUpdateSchema(def.type) }),
    async (req, res) => {
      const item = await content.updateContent(def, req.valid.params.id, {
        ...base(req),
        input: req.valid.body,
      });
      res.json({ data: item });
    },
  );

  router.put(
    '/:id/file',
    write,
    validate({ params: idParams }),
    uploadLimit,
    uploadFields(def.slots, { mode: def.replaceAll ? 'all' : 'any' }),
    validate({ body: mediaReplaceSchema(def.type) }),
    async (req, res) => {
      const { item, duplicates } = await content.replaceContentFiles(def, req.valid.params.id, {
        ...base(req),
        files: req.slotFiles,
        input: req.valid.body,
      });
      res.status(statusOf(item, 200)).json({ data: item, meta: meta(duplicates) });
    },
  );

  router.delete('/:id', write, validate({ params: idParams }), async (req, res) => {
    await content.deleteContent(def, req.valid.params.id, base(req));
    res.status(204).end();
  });

  return router;
}

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function contentRoutes(deps) {
  const router = Router();
  for (const def of Object.values(CONTENT_TYPES)) router.use(`/${def.type}`, typeRouter(def, deps));
  return router;
}
