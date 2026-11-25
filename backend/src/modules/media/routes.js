// medya kütüphanesi uçları (`media:*`). İçerik türü CRUD'ları modules/content'te.
import { Router } from 'express';
import { z } from 'zod';
import { MEDIA_KINDS } from '@my-portfolyo/shared';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/httpError.js';
import { requestContext } from '../audit/service.js';
import * as library from './library.js';
import { isValidAssetParams, sendAssetVariant } from './serve.js';

const listQuery = z
  .object({
    kind: z.enum(MEDIA_KINDS).optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']).optional(),
    orphan: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.uuid().optional(),
  })
  .strict();
const idParams = z.object({ id: z.uuid() }).strict();

export function mediaRoutes() {
  const router = Router();

  router.get('/storage', requirePermission('media:read'), async (_req, res) => {
    res.json({ data: await library.storageSummary() });
  });

  router.get(
    '/assets',
    requirePermission('media:read'),
    validate({ query: listQuery }),
    async (req, res) => {
      const { items, nextCursor } = await library.listAssets(req.valid.query);
      res.json({ data: items, meta: { nextCursor } });
    },
  );

  router.get(
    '/assets/:id',
    requirePermission('media:read'),
    validate({ params: idParams }),
    async (req, res) => {
      res.json({ data: await library.getAsset(req.valid.params.id) });
    },
  );

  // yetkili önizleme: pasif/yetim/PENDING olmayan her asset (READY dışı 404).
  router.get('/assets/:id/file/:variant', requirePermission('media:read'), async (req, res) => {
    const params = { assetId: req.params.id, variant: req.params.variant };
    if (!isValidAssetParams(params)) throw new NotFoundError();
    const asset = await library.findAssetWithOwners(params.assetId);
    if (!asset || asset.processingStatus !== 'READY') throw new NotFoundError();
    await sendAssetVariant(req, res, asset, params.variant, { cacheControl: 'private, no-store' });
  });

  router.delete(
    '/assets/:id',
    requirePermission('media:write'),
    validate({ params: idParams }),
    async (req, res) => {
      await library.deleteOrphanAsset(req.valid.params.id, req.admin.id, requestContext(req));
      res.status(204).end();
    },
  );

  return router;
}
