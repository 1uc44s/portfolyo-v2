// ROUTES.md §4.13 — /api/admin/audit-logs (`audit:read`). Salt okunur (FR-AUD-04): güncelleme/silme
// ucu yoktur. CSV dışa aktarma yalnızca SUPER_ADMIN (L5), en fazla 50 000 satır, stream.
import { Router } from 'express';
import { AUDIT_EXPORT_MAX_ROWS, auditFilterSchema, auditListQuerySchema } from '@vasquez/shared';
import { requirePermission, requireSuper } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  auditCsvChunks,
  auditFilterOptions,
  listAuditLogs,
  writeAudit,
  requestContext,
} from './service.js';

export function auditRoutes() {
  const router = Router();
  const read = requirePermission('audit:read');

  router.get('/', read, validate({ query: auditListQuerySchema }), async (req, res) => {
    const { items, meta } = await listAuditLogs(req.valid.query);
    res.json({ data: items, meta });
  });

  router.get('/filters', read, async (_req, res) => {
    res.json({ data: await auditFilterOptions() });
  });

  router.get(
    '/export.csv',
    read,
    requireSuper,
    validate({ query: auditFilterSchema }),
    async (req, res) => {
      await writeAudit({
        adminId: req.admin.id,
        action: 'AUDIT_EXPORTED',
        entityType: 'audit_log',
        metadata: { filters: Object.keys(req.valid.query) },
        ctx: requestContext(req),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);

      // İstemci bağlantıyı keserse sorgular durur; 'drain' beklerken askıda kalınmaz.
      let closed = false;
      const onClose = () => {
        closed = true;
      };
      res.once('close', onClose);
      const writable = () =>
        new Promise((resolve) => {
          const done = () => {
            res.off('drain', done);
            res.off('close', done);
            resolve();
          };
          res.once('drain', done);
          res.once('close', done);
        });

      try {
        for await (const chunk of auditCsvChunks(req.valid.query, {
          maxRows: AUDIT_EXPORT_MAX_ROWS,
        })) {
          if (closed) break;
          if (!res.write(chunk)) await writable();
        }
        if (!closed) res.end();
      } catch (err) {
        // Başlıklar gönderildi: JSON hata yanıtı yazılamaz; bağlantı kesilir, hata loglanır.
        req.log?.error({ err }, 'Audit CSV dışa aktarımı yarıda kaldı');
        res.destroy(err);
      } finally {
        res.off('close', onClose);
      }
    },
  );

  return router;
}
