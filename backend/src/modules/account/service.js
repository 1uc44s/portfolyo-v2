// Hesap Ayarları (yalnızca kendi hesabı) + SMTP ayarları.
import QRCode from 'qrcode';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { decrypt, encrypt } from '../../lib/crypto.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import {
  getMailSettings,
  getSiteName,
  isMailConfigured,
  sendTemplatedEmail,
} from '../../mail/transport.js';
import { rateLimitedError } from '../../middleware/rateLimit.js';
import { writeAudit } from '../audit/service.js';
import { assertStrongPassword, hashPassword, verifyPassword } from '../auth/password.js';
import { consumeRecoveryCode, replaceRecoveryCodes } from '../auth/recoveryCodes.js';
import {
  invalidateAdminCache,
  listActiveSessions,
  revokeAllForAdmin,
  revokeFamily,
} from '../auth/sessions.js';
import { toPublicAdmin } from '../auth/service.js';
import { buildOtpauthUrl, generateTotpSecret, verifyTotp } from '../auth/totp.js';

const wrongCurrentPassword = () =>
  new ValidationError([{ path: 'currentPassword', message: 'Mevcut şifre hatalı.' }]);
const wrongCode = (path = 'code') =>
  new ValidationError([{ path, message: 'Doğrulama kodu hatalı.' }]);

async function loadAdmin(adminId) {
  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin) throw new NotFoundError();
  return admin;
}

/**
 * Yeniden doğrulama (mevcut şifre / 2FA kodu) hataları: admin başına 15 dk'da 5. Açık kalmış ya da
 * çalınmış bir oturumla şifre tahmin edilip e-posta/şifre/2FA değiştirilmesini önler.
 */
export const REAUTH_MAX_FAILURES = 5;
const reauthFailures = new RateLimiterMemory({
  keyPrefix: 'reauth',
  points: REAUTH_MAX_FAILURES,
  duration: 15 * 60,
});

async function assertReauthAllowed(admin) {
  const res = await reauthFailures.get(admin.id);
  if (res && res.consumedPoints >= REAUTH_MAX_FAILURES) throw rateLimitedError(res);
}

/** Hatayı sayar, audit'e yazar ve verilen hatayı fırlatır. */
async function failReauth(admin, ctx, error) {
  await reauthFailures.penalty(admin.id, 1);
  await writeAudit({
    adminId: admin.id,
    action: 'AUTH_REAUTH_FAILED',
    metadata: { field: error.details?.[0]?.path ?? null },
    ctx,
  });
  throw error;
}

async function requireCurrentPassword(admin, currentPassword, ctx) {
  await assertReauthAllowed(admin);
  if (!(await verifyPassword(admin.passwordHash, currentPassword))) {
    await failReauth(admin, ctx, wrongCurrentPassword());
  }
}

/** TOTP doğrular ve adımı kaydeder (replay koruması). */
async function consumeTotp(admin, secretEnc, code) {
  const step = verifyTotp(decrypt(secretEnc), code, { lastStep: admin.lastTotpStep });
  if (step === null) return false;
  const { count } = await prisma.adminUser.updateMany({
    where: {
      id: admin.id,
      OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: BigInt(step) } }],
    },
    data: { lastTotpStep: BigInt(step) },
  });
  return count === 1;
}

export async function updateProfile(adminId, { displayName }, ctx) {
  const admin = await prisma.adminUser.update({
    where: { id: adminId },
    data: { displayName: displayName || null },
  });
  invalidateAdminCache(adminId);
  await writeAudit({
    adminId,
    action: 'ADMIN_UPDATED',
    metadata: { fields: ['displayName'] },
    ctx,
  });
  return toPublicAdmin(admin);
}

export async function changeEmail(adminId, { newEmail, currentPassword }, ctx) {
  const admin = await loadAdmin(adminId);
  await requireCurrentPassword(admin, currentPassword, ctx);
  if (newEmail === admin.email) return toPublicAdmin(admin);
  try {
    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: { email: newEmail },
    });
    invalidateAdminCache(adminId);
    await writeAudit({ adminId, action: 'EMAIL_CHANGED', ctx });
    return toPublicAdmin(updated);
  } catch (err) {
    if (err.code === 'P2002') throw new ConflictError('Bu e-posta başka bir hesapta kullanılıyor.');
    throw err;
  }
}

/** mevcut oturum hariç tüm oturumlar kapanır. */
export async function changePassword(adminId, familyId, { currentPassword, newPassword }, ctx) {
  const admin = await loadAdmin(adminId);
  await requireCurrentPassword(admin, currentPassword, ctx);
  assertStrongPassword(newPassword, admin);
  const updated = await prisma.adminUser.update({
    where: { id: adminId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });
  await revokeAllForAdmin(adminId, { reason: 'PASSWORD_CHANGE', exceptFamilyId: familyId });
  invalidateAdminCache(adminId);
  await writeAudit({ adminId, action: 'PASSWORD_CHANGED', ctx });
  return toPublicAdmin(updated);
}

/** kurulum: geçici secret şifreli saklanır, QR döner. */
export async function setupTwoFactor(adminId, { currentPassword }, ctx) {
  const admin = await loadAdmin(adminId);
  await requireCurrentPassword(admin, currentPassword, ctx);
  if (admin.totpEnabled) throw new ConflictError('İki aşamalı doğrulama zaten açık.');

  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpPendingSecretEnc: encrypt(secret) },
  });
  const otpauthUrl = buildOtpauthUrl({
    secret,
    account: admin.email,
    issuer: await getSiteName(),
  });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
  return { otpauthUrl, qrDataUrl, secret };
}

export async function enableTwoFactor(adminId, familyId, { code }, ctx) {
  const admin = await loadAdmin(adminId);
  if (admin.totpEnabled) throw new ConflictError('İki aşamalı doğrulama zaten açık.');
  if (!admin.totpPendingSecretEnc) {
    throw new AppError(409, 'CONFLICT', 'Önce kurulumu başlatmalısın.');
  }
  await assertReauthAllowed(admin);
  if (!(await consumeTotp(admin, admin.totpPendingSecretEnc, code))) {
    await failReauth(admin, ctx, wrongCode());
  }

  const recoveryCodes = await prisma.$transaction(async (tx) => {
    await tx.adminUser.update({
      where: { id: adminId },
      data: {
        totpEnabled: true,
        totpSecretEnc: admin.totpPendingSecretEnc,
        totpPendingSecretEnc: null,
      },
    });
    return replaceRecoveryCodes(adminId, tx);
  });
  await revokeAllForAdmin(adminId, { reason: '2FA_CHANGED', exceptFamilyId: familyId });
  invalidateAdminCache(adminId);
  await writeAudit({ adminId, action: '2FA_ENABLED', ctx });
  return { recoveryCodes };
}

async function requireSecondFactor(admin, { code, recoveryCode }, ctx) {
  await assertReauthAllowed(admin);
  const ok = code
    ? await consumeTotp(admin, admin.totpSecretEnc, code)
    : await consumeRecoveryCode(admin.id, recoveryCode);
  if (!ok) await failReauth(admin, ctx, wrongCode(code ? 'code' : 'recoveryCode'));
}

export async function disableTwoFactor(adminId, familyId, input, ctx) {
  const admin = await loadAdmin(adminId);
  if (!admin.totpEnabled) throw new ConflictError('İki aşamalı doğrulama zaten kapalı.');
  await requireCurrentPassword(admin, input.currentPassword, ctx);
  await requireSecondFactor(admin, input, ctx);

  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: adminId },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpPendingSecretEnc: null,
        lastTotpStep: null,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { adminId } }),
  ]);
  await revokeAllForAdmin(adminId, { reason: '2FA_CHANGED', exceptFamilyId: familyId });
  invalidateAdminCache(adminId);
  await writeAudit({ adminId, action: '2FA_DISABLED', ctx });
}

export async function regenerateRecoveryCodes(adminId, { currentPassword, code }, ctx) {
  const admin = await loadAdmin(adminId);
  if (!admin.totpEnabled) throw new ConflictError('İki aşamalı doğrulama kapalı.');
  await requireCurrentPassword(admin, currentPassword, ctx);
  if (!(await consumeTotp(admin, admin.totpSecretEnc, code))) {
    await failReauth(admin, ctx, wrongCode());
  }
  const recoveryCodes = await replaceRecoveryCodes(adminId);
  await writeAudit({ adminId, action: '2FA_RECOVERY_REGENERATED', ctx });
  return { recoveryCodes };
}

export async function getSessions(adminId, currentFamilyId) {
  const sessions = await listActiveSessions(adminId);
  return sessions.map(({ familyId, ...rest }) => ({
    id: familyId,
    current: familyId === currentFamilyId,
    ...rest,
  }));
}

export async function revokeSession(adminId, familyId, ctx) {
  const owned = await prisma.adminSession.findFirst({
    where: { adminId, familyId },
    select: { id: true },
  });
  if (!owned) throw new NotFoundError('Oturum bulunamadı.');
  await revokeFamily(familyId, 'ADMIN_REVOKE');
  await writeAudit({
    adminId,
    action: 'SESSION_REVOKED',
    entityType: 'AdminSession',
    entityId: familyId,
    ctx,
  });
}

export async function revokeOtherSessions(adminId, currentFamilyId, ctx) {
  const count = await revokeAllForAdmin(adminId, {
    reason: 'ADMIN_REVOKE',
    exceptFamilyId: currentFamilyId,
  });
  await writeAudit({ adminId, action: 'SESSION_REVOKED', metadata: { others: count }, ctx });
  return { revoked: count };
}

/** SMTP ayarları — uygulama anahtarı asla geri dönmez. */
const toPublicMailSettings = (s) => ({
  smtpHost: s?.smtpHost ?? null,
  smtpPort: s?.smtpPort ?? null,
  smtpSecure: s?.smtpSecure ?? true,
  smtpUser: s?.smtpUser ?? null,
  appPassword: { isSet: Boolean(s?.appPasswordEnc) },
  fromName: s?.fromName ?? null,
  fromEmail: s?.fromEmail ?? null,
  notifyOnContact: s?.notifyOnContact ?? false,
  notifyEmail: s?.notifyEmail ?? null,
  lastTestAt: s?.lastTestAt ?? null,
  lastTestOk: s?.lastTestOk ?? null,
  configured: isMailConfigured(s),
});

export async function getMail() {
  return toPublicMailSettings(await getMailSettings());
}

export async function updateMail(adminId, input, ctx) {
  const { appPassword, ...fields } = input;
  const data = { ...fields };
  if (appPassword === null) data.appPasswordEnc = null;
  else if (typeof appPassword === 'string') data.appPasswordEnc = encrypt(appPassword);

  const settings = await prisma.mailSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  await writeAudit({
    adminId,
    action: 'MAIL_SETTINGS_UPDATED',
    metadata: { fields: Object.keys(input) },
    ctx,
  });
  return toPublicMailSettings(settings);
}

export async function testMail(admin, { to }, ctx) {
  const settings = await getMailSettings();
  if (!isMailConfigured(settings)) {
    throw new AppError(409, 'MAIL_NOT_CONFIGURED', 'Önce e-posta gönderim ayarlarını kaydet.');
  }
  let ok = true;
  let reason = null;
  try {
    await sendTemplatedEmail({
      key: 'SMTP_TEST',
      to: to ?? admin.email,
      vars: { sentAt: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }) },
    });
  } catch (err) {
    ok = false;
    // Hata mesajı sunucu yanıtı içerebilir; yalnızca kod döndürülür (secret sızmaz).
    reason = String(err.code ?? err.responseCode ?? 'UNKNOWN').slice(0, 40);
  }
  await prisma.mailSettings.update({
    where: { id: 1 },
    data: { lastTestAt: new Date(), lastTestOk: ok },
  });
  await writeAudit({ adminId: admin.id, action: 'SMTP_TESTED', metadata: { ok, reason }, ctx });
  if (!ok) {
    throw new AppError(502, 'UPSTREAM_ERROR', `SMTP bağlantısı başarısız (${reason}).`);
  }
  return { ok: true };
}
