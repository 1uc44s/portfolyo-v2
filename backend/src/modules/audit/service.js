// SRS §6 / RULES.md §6 — admin işlem kayıtları. Metadata yazılmadan önce redakte edilir.
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

const SENSITIVE_KEY = /pass|secret|token|key|code|hash|authorization|cookie/i;
const MAX_DEPTH = 5;

/** SRS FR-AUD-03 — hassas anahtar adlı her alan "[REDACTED]" olur. */
export function redact(value, depth = 0) {
  if (depth > MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1),
      ]),
    );
  }
  return value;
}

/** İstekten güvenli bağlam (IP + kısaltılmış user-agent). */
export function requestContext(req) {
  return {
    ipAddress: req?.ip?.slice(0, 45) ?? null,
    userAgent: req?.get?.('user-agent')?.slice(0, 400) ?? null,
  };
}

/**
 * Audit kaydı yazar. Hata akışı bozmaz (loglanır); güvenlik olayı kaybolmasın diye
 * çağıranlar await eder.
 * @param {{ adminId?: string|null, action: string, entityType?: string, entityId?: string|number,
 *   metadata?: object, req?: import('express').Request, ctx?: {ipAddress?: string|null, userAgent?: string|null} }} entry
 */
export async function writeAudit({
  adminId = null,
  action,
  entityType,
  entityId,
  metadata,
  req,
  ctx,
}) {
  const context = ctx ?? requestContext(req);
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entityType: entityType ?? null,
        entityId: entityId == null ? null : String(entityId),
        metadata: metadata ? redact(metadata) : undefined,
        ipAddress: context.ipAddress ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action }, 'Audit kaydı yazılamadı');
  }
}

// ---------------------------------------------------------------------------------------------
// Okuma (ROUTES.md §4.13, FR-AUD-04/05). Kayıtlar salt okunur: güncelleme/silme ucu yoktur.

const ADMIN_SELECT = { select: { id: true, email: true, displayName: true } };

/** Filtre → Prisma where. `action` ve `entityType` tam eşleşme, `entityId` tam eşleşme. */
export function auditWhere({ from, to, adminId, action, entityType, entityId } = {}) {
  const where = {};
  if (from || to) where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) };
  if (adminId) where.adminId = adminId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  return where;
}

const actorOf = (admin) =>
  admin ? { id: admin.id, email: admin.email, displayName: admin.displayName } : null;

/** BigInt id ve ilişki API'ye güvenli şekle çevrilir. Metadata yazımda redakte edildi. */
export function auditRow(row) {
  return {
    id: String(row.id),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata ?? null,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    actor: actorOf(row.admin),
  };
}

export async function listAuditLogs({ page, limit, ...filters }) {
  const where = auditWhere(filters);
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: { admin: ADMIN_SELECT },
    }),
  ]);
  return { items: rows.map(auditRow), meta: { total, page, limit } };
}

/** Filtre seçenekleri: kayıtlarda geçen eylem/varlık türleri ve yöneticiler. */
export async function auditFilterOptions() {
  const [actions, entityTypes, admins] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { entityType: { not: null } },
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    }),
    prisma.adminUser.findMany({
      select: { id: true, email: true, displayName: true },
      orderBy: { email: 'asc' },
    }),
  ]);
  return {
    actions: actions.map((a) => a.action),
    entityTypes: entityTypes.map((e) => e.entityType),
    admins,
  };
}

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'actorEmail',
  'action',
  'entityType',
  'entityId',
  'ipAddress',
  'userAgent',
  'metadata',
];

/** RFC 4180 + CSV/formül enjeksiyonu önlemi (=,+,-,@ ile başlayan hücre "'" ile kaçar). */
export function csvCell(value) {
  if (value == null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Excel Türkçe karakterleri doğru açsın diye UTF-8 BOM. */
const UTF8_BOM = String.fromCharCode(0xfeff);

const csvLine = (cells) => `${cells.map(csvCell).join(',')}\r\n`;

/**
 * Filtreli kayıtları CSV olarak parça parça üretir (en fazla `maxRows`, createdAt DESC).
 * Keyset sayfalama: bellekte tüm tablo tutulmaz.
 */
export async function* auditCsvChunks(filters, { maxRows, batchSize = 1000 }) {
  yield UTF8_BOM + csvLine(CSV_COLUMNS);
  const where = auditWhere(filters);
  let cursor = null;
  let sent = 0;
  while (sent < maxRows) {
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(batchSize, maxRows - sent),
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: { admin: ADMIN_SELECT },
    });
    if (rows.length === 0) break;
    yield rows
      .map((r) =>
        csvLine([
          String(r.id),
          r.createdAt,
          r.admin?.email ?? '',
          r.action,
          r.entityType,
          r.entityId,
          r.ipAddress,
          r.userAgent,
          r.metadata == null ? '' : JSON.stringify(r.metadata),
        ]),
      )
      .join('');
    sent += rows.length;
    cursor = rows.at(-1).id;
  }
}
