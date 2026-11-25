// audit log liste/dışa aktarma filtreleri.
import { z } from 'zod';

export const AUDIT_EXPORT_MAX_ROWS = 50_000;

const emptyToUndefined = (v) => (v === '' ? undefined : v);
const textParam = (max) => z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());
const dateParam = z.preprocess(emptyToUndefined, z.coerce.date().optional());

const filterShape = {
  from: dateParam,
  to: dateParam,
  adminId: z.preprocess(emptyToUndefined, z.uuid().optional()),
  action: textParam(60),
  entityType: textParam(40),
  entityId: textParam(64),
};

const rangeOk = (v) => !v.from || !v.to || v.from <= v.to;
const rangeError = { message: 'Başlangıç tarihi bitişten sonra olamaz.', path: ['from'] };

/** CSV dışa aktarma: yalnızca filtreler. */
export const auditFilterSchema = z.object(filterShape).strict().refine(rangeOk, rangeError);

/** Liste: filtreler + sayfalama (createdAt DESC). */
export const auditListQuerySchema = z
  .object({
    ...filterShape,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine(rangeOk, rangeError);
