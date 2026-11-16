// SRS §3.1 (FR-AUTH-01..07), ARCHITECTURE.md §4 — giriş, 2FA, refresh rotasyonu, çıkış.
import { decrypt } from '../../lib/crypto.js';
import { safeEqual } from '../../lib/hash.js';
import { AppError, UnauthenticatedError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { csrfTokenFor } from './cookies.js';
import { verifyDummyPassword, verifyPassword } from './password.js';
import { consumeRecoveryCode } from './recoveryCodes.js';
import {
  createSession,
  findSessionByRefreshToken,
  revokeFamily,
  rotateSession,
  sessionRejectReason,
} from './sessions.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  signMfaToken,
  verifyMfaToken,
} from './tokens.js';
import { verifyTotp } from './totp.js';

export const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.');
const csrfFailed = () => new AppError(403, 'CSRF_FAILED', 'İstek doğrulanamadı. Sayfayı yenile.');
const sessionEnded = () => new UnauthenticatedError('Oturumun sona erdi. Yeniden giriş yap.');
const mfaExpired = () =>
  new AppError(401, 'MFA_EXPIRED', 'Doğrulama süresi doldu. Yeniden giriş yap.');

/** API'ye dönen yönetici alanları (hash/secret asla). */
export const toPublicAdmin = (admin) => ({
  id: admin.id,
  email: admin.email,
  displayName: admin.displayName,
  role: admin.role,
  permissions: admin.permissions,
  mustChangePassword: admin.mustChangePassword,
  totpEnabled: admin.totpEnabled,
});

async function completeLogin(admin, rememberMe, ctx, method) {
  const { session, refreshToken } = await createSession({ adminId: admin.id, rememberMe, ...ctx });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({
    adminId: admin.id,
    action: 'AUTH_LOGIN_SUCCESS',
    metadata: { method, rememberMe },
    ctx,
  });
  return {
    accessToken: await signAccessToken(admin, session.familyId),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    admin: toPublicAdmin(admin),
    session,
    refreshToken,
  };
}

/**
 * FR-AUTH-01, US-20 — kilit, numaralandırma koruması, 2FA ayrımı.
 * @param {{ email: string, password: string, rememberMe: boolean }} input
 * @param {{ ipAddress?: string|null, userAgent?: string|null }} ctx
 */
export async function login({ email, password, rememberMe }, ctx) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    await verifyDummyPassword(password);
    await writeAudit({ action: 'AUTH_LOGIN_FAILED', metadata: { reason: 'UNKNOWN_ACCOUNT' }, ctx });
    throw invalidCredentials();
  }

  const passwordOk = await verifyPassword(admin.passwordHash, password);
  const now = Date.now();

  if (admin.lockedUntil && admin.lockedUntil.getTime() > now) {
    await writeAudit({
      adminId: admin.id,
      action: 'AUTH_LOGIN_FAILED',
      metadata: { reason: 'LOCKED' },
      ctx,
    });
    // Kilit yalnızca doğru şifre girilirse açıklanır (ROUTES.md §5).
    if (!passwordOk) throw invalidCredentials();
    const retryAfter = Math.ceil((admin.lockedUntil.getTime() - now) / 1000);
    throw new AppError(
      423,
      'ACCOUNT_LOCKED',
      'Hesap geçici olarak kilitlendi. Biraz sonra tekrar dene.',
      { headers: { 'Retry-After': String(retryAfter) }, details: { retryAfter } },
    );
  }

  if (!passwordOk) {
    const failures = admin.failedLoginCount + 1;
    const lock = failures >= LOCK_THRESHOLD;
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(now + LOCK_DURATION_MS) }
        : { failedLoginCount: failures },
    });
    await writeAudit({
      adminId: admin.id,
      action: 'AUTH_LOGIN_FAILED',
      metadata: { reason: 'BAD_PASSWORD' },
      ctx,
    });
    if (lock) await writeAudit({ adminId: admin.id, action: 'AUTH_LOCKED', ctx });
    throw invalidCredentials();
  }

  if (!admin.isActive) {
    await writeAudit({
      adminId: admin.id,
      action: 'AUTH_LOGIN_FAILED',
      metadata: { reason: 'INACTIVE' },
      ctx,
    });
    throw invalidCredentials();
  }

  if (admin.failedLoginCount > 0 || admin.lockedUntil) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }

  if (admin.totpEnabled) {
    return { mfaRequired: true, mfaToken: await signMfaToken(admin.id, rememberMe) };
  }
  return completeLogin(admin, rememberMe, ctx, 'PASSWORD');
}

/** Kullanılmış MFA token'ları (tek kullanımlık). jti → exp (ms). */
const usedMfaTokens = new Map();

function markMfaTokenUsed(jti, expSeconds) {
  const now = Date.now();
  for (const [key, exp] of usedMfaTokens) if (exp <= now) usedMfaTokens.delete(key);
  usedMfaTokens.set(jti, expSeconds * 1000);
}

/**
 * FR-AUTH-02, FR-AUTH-13 — TOTP (replay korumalı) veya kurtarma kodu.
 * @param {{ mfaToken: string, code?: string, recoveryCode?: string }} input
 */
export async function verifySecondFactor({ mfaToken, code, recoveryCode }, ctx) {
  const { adminId, rememberMe, jti, exp } = await verifyMfaToken(mfaToken);
  if (usedMfaTokens.has(jti)) throw mfaExpired();

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin?.isActive || !admin.totpEnabled || !admin.totpSecretEnc) throw mfaExpired();

  let verified = false;
  if (code) {
    const step = verifyTotp(decrypt(admin.totpSecretEnc), code, { lastStep: admin.lastTotpStep });
    if (step !== null) {
      // Aynı adımın eşzamanlı ikinci kullanımı updateMany koşuluyla engellenir.
      const { count } = await prisma.adminUser.updateMany({
        where: {
          id: admin.id,
          OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: BigInt(step) } }],
        },
        data: { lastTotpStep: BigInt(step) },
      });
      verified = count === 1;
    }
  } else {
    verified = await consumeRecoveryCode(admin.id, recoveryCode);
  }

  if (!verified) {
    await writeAudit({
      adminId: admin.id,
      action: 'AUTH_2FA_FAILED',
      metadata: { method: code ? 'TOTP' : 'RECOVERY_CODE' },
      ctx,
    });
    throw new AppError(401, 'INVALID_2FA_CODE', 'Doğrulama kodu hatalı.');
  }

  markMfaTokenUsed(jti, exp);
  return completeLogin(admin, rememberMe, ctx, code ? 'TOTP' : 'RECOVERY_CODE');
}

async function handleReuse(row, ctx, metadata) {
  await revokeFamily(row.familyId, 'REUSE');
  await writeAudit({
    adminId: row.adminId,
    action: 'SESSION_REUSE_DETECTED',
    entityType: 'AdminSession',
    entityId: row.familyId,
    metadata,
    ctx,
  });
}

/**
 * ARCHITECTURE.md §4.3 — rotasyon ve reuse tespiti.
 * @param {{ refreshToken?: string, csrfHeader?: string, csrfCookie?: string }} input
 */
export async function refreshSession({ refreshToken, csrfHeader, csrfCookie }, ctx) {
  const row = await findSessionByRefreshToken(refreshToken);
  if (!row) throw sessionEnded();

  // Döndürülmüş token tekrar geldiyse (çalınmış olabilir) aile hemen iptal edilir.
  if (row.rotatedAt && !row.revokedAt) {
    await handleReuse(row, ctx);
    throw sessionEnded();
  }

  const expected = csrfTokenFor(row.id);
  if (!safeEqual(csrfHeader, expected) || !safeEqual(csrfCookie, expected)) throw csrfFailed();

  const reason = sessionRejectReason(row);
  if (reason) {
    if (reason !== 'REVOKED') await revokeFamily(row.familyId, reason);
    throw sessionEnded();
  }

  const rotated = await rotateSession(row, ctx);
  if (!rotated) {
    await handleReuse(row, ctx, { race: true });
    throw sessionEnded();
  }

  return {
    accessToken: await signAccessToken(row.admin, row.familyId),
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    admin: toPublicAdmin(row.admin),
    ...rotated,
  };
}

/** FR-AUTH-06 — mevcut oturum ailesini iptal eder. */
export async function logout({ refreshToken, csrfHeader, csrfCookie }, ctx) {
  const row = await findSessionByRefreshToken(refreshToken);
  if (!row) return;
  const expected = csrfTokenFor(row.id);
  if (!safeEqual(csrfHeader, expected) || !safeEqual(csrfCookie, expected)) throw csrfFailed();
  await revokeFamily(row.familyId, 'LOGOUT');
  await writeAudit({
    adminId: row.adminId,
    action: 'AUTH_LOGOUT',
    entityType: 'AdminSession',
    entityId: row.familyId,
    ctx,
  });
}

/** @param {string} adminId */
export async function getMe(adminId) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw sessionEnded();
  return toPublicAdmin(admin);
}
