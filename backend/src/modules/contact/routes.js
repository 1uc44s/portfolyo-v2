// ROUTES.md §4.11 — /api/admin/contact-messages (`messages:*`). Açmak (`GET /:id`) okuma izniyle
// okundu işaretler; durum/spam/silme/yanıt linki yazma izni ister.
import { Router } from 'express';
import { z } from 'zod';
import { contactListQuerySchema, contactPatchSchema } from '@vasquez/shared';
import { requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { NotFoundError } from '../../lib/httpError.js';
import { requestContext } from '../audit/service.js';
import * as contact from './service.js';

const idParams = z.object({ id: z.uuid() }).strict();

/** Geçersiz UUID de 404 (ifşa yok). */
const parseId = (req) => {
  const parsed = idParams.safeParse(req.params);
  if (!parsed.success) throw new NotFoundError('Mesaj bulunamadı.');
  return parsed.data.id;
};

export function contactMessageRoutes() {
  const router = Router();
  const read = requirePermission('messages:read');
  const write = requirePermission('messages:write');
  const base = (req) => ({ adminId: req.admin.id, ctx: requestContext(req) });

  router.get('/', read, validate({ query: contactListQuerySchema }), async (req, res) => {
    const { items, meta } = await contact.listMessages(req.valid.query);
    res.json({ data: items, meta });
  });

  router.get('/unread-count', read, async (_req, res) => {
    res.json({ data: { count: await contact.unreadCount() } });
  });

  router.get('/:id', read, async (req, res) => {
    res.json({ data: await contact.openMessage(parseId(req)) });
  });

  router.patch('/:id', write, validate({ body: contactPatchSchema }), async (req, res) => {
    res.json({ data: await contact.updateMessage(parseId(req), req.valid.body, base(req)) });
  });

  router.post('/:id/reply-links', write, async (req, res) => {
    res.json({ data: await contact.replyLinks(parseId(req), base(req)) });
  });

  router.delete('/:id', write, async (req, res) => {
    await contact.deleteMessage(parseId(req), base(req));
    res.status(204).end();
  });

  return router;
}
