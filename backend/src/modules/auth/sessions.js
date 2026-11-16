// ARCHITECTURE.md §4.3, §7 — refresh oturumları: rotasyon, reuse tespiti, mutlak ömür, iptal.
// Bir "oturum ailesi" (familyId) bir cihaz girişidir; her refresh ailede yeni bir satır açar.
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { randomToken, sha256Hex } from '../../lib/hash.js';

export const REMEMBER_ME_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const LIVENESS_CACHE_MS = 30_000;

export const ADMIN_PUBLIC_SELECT = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  permissions: true,
  isActive: true,
  mustChangePassword: true,
  totpEnabled: true,
};

/** familyId → { value, until } — requireAuth'un her istekte DB'ye gitmesini önler. */
const livenessCache = new Map();

export const invalidateFamilyCache = (familyId) => livenessCache.delete(familyId);
export const clearLivenessCache = () => livenessCache.clear();

/** Yönetici alanları değişince (şifre, e-posta, rol, 2FA) önbellekteki kopyaları düşürür. */
export function invalidateAdminCache(adminId) {
  for (const [familyId, entry] of livenessCache) {
    if (entry.value?.admin?.id === adminId) livenessCache.delete(familyId);
  }
}

/**
 * @param {{ adminId: string, rememberMe: boolean, ipAddress?: string|null, userAgent?: string|null }} input
 * @param {import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function createSession(input, db = prisma) {
  const refreshToken = randomToken(32);
  const session = await db.adminSession.create({
    data: {
      adminId: input.adminId,
      familyId: randomUUID(),
      refreshTokenHash: sha256Hex(refreshToken),
      rememberMe: input.rememberMe,
      expiresAt: new Date(Date.now() + (input.rememberMe ? REMEMBER_ME_TTL_MS : SESSION_TTL_MS)),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return { session, refreshToken };
}

/** Refresh token'a ait satırı (admin ile) bulur; yoksa null. @param {string|undefined} token */
export async function findSessionByRefreshToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
  return prisma.adminSession.findUnique({
    where: { refreshTokenHash: sha256Hex(token) },
    include: { admin: { select: ADMIN_PUBLIC_SELECT } },
  });
}

/**
 * Bir satırın neden kullanılamayacağını döndürür; kullanılabilirse null.
 * @returns {null|'REVOKED'|'EXPIRED'|'IDLE'|'REUSE'|'INACTIVE'}
 */
export function sessionRejectReason(row, now = Date.now()) {
  if (row.revokedAt) return 'REVOKED';
  if (row.rotatedAt) return 'REUSE';
  if (row.expiresAt.getTime() <= now) return 'EXPIRED';
  if (!row.rememberMe && now - row.lastUsedAt.getTime() > IDLE_TIMEOUT_MS) return 'IDLE';
  if (!row.admin?.isActive) return 'INACTIVE';
  return null;
}

/**
 * Satırı döndürür (yenisiyle değiştirir). Mutlak ömür korunur: yeni satır ailenin bitişini devralır.
 * Eşzamanlı ikinci döndürme denemesi count=0 alır → null (çağıran reuse sayar).
 */
export async function rotateSession(row, { ipAddress, userAgent } = {}) {
  const refreshToken = randomToken(32);
  const now = new Date();
  const next = await prisma.$transaction(async (tx) => {
    const { count } = await tx.adminSession.updateMany({
      where: { id: row.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: now },
    });
    if (count !== 1) return null;
    return tx.adminSession.create({
      data: {
        adminId: row.adminId,
        familyId: row.familyId,
        refreshTokenHash: sha256Hex(refreshToken),
        rememberMe: row.rememberMe,
        expiresAt: row.expiresAt,
        lastUsedAt: now,
        ipAddress: ipAddress ?? row.ipAddress,
        userAgent: userAgent ?? row.userAgent,
      },
    });
  });
  invalidateFamilyCache(row.familyId);
  return next ? { session: next, refreshToken } : null;
}

/** @param {string} familyId @param {string} reason */
export async function revokeFamily(familyId, reason) {
  await prisma.adminSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  invalidateFamilyCache(familyId);
}

/**
 * Yöneticinin tüm oturumlarını iptal eder (isteğe bağlı olarak biri hariç).
 * @param {string} adminId
 * @param {{ reason: string, exceptFamilyId?: string|null }} options
 */
export async function revokeAllForAdmin(adminId, { reason, exceptFamilyId = null }) {
  const where = {
    adminId,
    revokedAt: null,
    ...(exceptFamilyId && { familyId: { not: exceptFamilyId } }),
  };
  const families = await prisma.adminSession.findMany({
    where,
    select: { familyId: true },
    distinct: ['familyId'],
  });
  await prisma.adminSession.updateMany({
    where,
    data: { revokedAt: new Date(), revokedReason: reason },
  });
  for (const { familyId } of families) invalidateFamilyCache(familyId);
  return families.length;
}

/**
 * Ailenin canlı baş satırı ve yöneticisi (requireAuth). 30 sn önbellekli.
 * @param {string} familyId
 */
export async function getLiveFamily(familyId) {
  const cached = livenessCache.get(familyId);
  if (cached && cached.until > Date.now()) return cached.value;

  const head = await prisma.adminSession.findFirst({
    where: { familyId, revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, admin: { select: ADMIN_PUBLIC_SELECT } },
  });
  const value = head?.admin?.isActive ? { sessionId: head.id, admin: head.admin } : null;
  livenessCache.set(familyId, { value, until: Date.now() + LIVENESS_CACHE_MS });
  return value;
}

/** Hesap Ayarları > Oturumlar: her ailenin canlı baş satırı. @param {string} adminId */
export async function listActiveSessions(adminId) {
  const heads = await prisma.adminSession.findMany({
    where: { adminId, revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      familyId: true,
      rememberMe: true,
      ipAddress: true,
      userAgent: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });
  if (heads.length === 0) return [];
  const firstSeen = await prisma.adminSession.groupBy({
    by: ['familyId'],
    where: { familyId: { in: heads.map((h) => h.familyId) } },
    _min: { createdAt: true },
  });
  const createdAtByFamily = new Map(firstSeen.map((f) => [f.familyId, f._min.createdAt]));
  return heads.map((h) => ({ ...h, createdAt: createdAtByFamily.get(h.familyId) ?? null }));
}
