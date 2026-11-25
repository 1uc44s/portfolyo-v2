// /api/admin/system: yasal metinler (KVKK aydınlatma, çerez politikası).
import { Router } from 'express';
import { z } from 'zod';
import { LEGAL_DOC_SLUGS, legalUpdateSchema } from '@my-portfolyo/shared';
import { NotFoundError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requestContext, writeAudit } from '../audit/service.js';
import { invalidateSiteCache } from '../public/site.js';
import { LEGAL_SLUGS } from '../public/legal.js';

const keyParams = z.object({ key: z.enum(LEGAL_DOC_SLUGS) }).strict();
const select = { key: true, title: true, bodyMarkdown: true, version: true, updatedAt: true };

async function findDoc(slug) {
  const doc = await prisma.legalDocument.findUnique({ where: { key: LEGAL_SLUGS[slug] }, select });
  if (!doc) throw new NotFoundError('Metin bulunamadı.');
  return doc;
}

export function systemRoutes() {
  const router = Router();

  router.get('/legal', requirePermission('system:read'), async (_req, res) => {
    res.json({
      data: await Promise.all(
        LEGAL_DOC_SLUGS.map(async (slug) => ({ slug, ...(await findDoc(slug)) })),
      ),
    });
  });

  router.get(
    '/legal/:key',
    requirePermission('system:read'),
    validate({ params: keyParams }),
    async (req, res) => {
      res.json({ data: { slug: req.valid.params.key, ...(await findDoc(req.valid.params.key)) } });
    },
  );

  router.put(
    '/legal/:key',
    requirePermission('system:write'),
    validate({ params: keyParams, body: legalUpdateSchema }),
    async (req, res) => {
      const slug = req.valid.params.key;
      const current = await findDoc(slug);
      const { title, bodyMarkdown, bumpVersion } = req.valid.body;
      const doc = await prisma.legalDocument.update({
        where: { key: current.key },
        data: { title, bodyMarkdown, ...(bumpVersion ? { version: { increment: 1 } } : {}) },
        select,
      });
      // Çerez politikası sürümü /api/public/site'ta (banner yeniden sorar).
      invalidateSiteCache();
      await writeAudit({
        adminId: req.admin.id,
        action: 'LEGAL_UPDATED',
        entityType: 'LegalDocument',
        entityId: doc.key,
        metadata: { version: doc.version, bumped: bumpVersion },
        ctx: requestContext(req),
      });
      res.json({ data: { slug, ...doc } });
    },
  );

  return router;
}
