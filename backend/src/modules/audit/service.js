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
