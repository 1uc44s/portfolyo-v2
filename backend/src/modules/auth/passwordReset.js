// FR-AUTH-10/11, ARCHITECTURE.md §4.5 — şifremi unuttum / sıfırla.
// Yanıt her durumda aynı ve benzer sürede döner (hesap numaralandırma önlemi).
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { env } from '../../config/env.js';
import { hmacBase64Url, randomToken, sha256Hex } from '../../lib/hash.js';
import { AppError } from '../../lib/httpError.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { getMailSettings, isMailConfigured, sendTemplatedEmail } from '../../mail/transport.js';
import { writeAudit } from '../audit/service.js';
import { assertStrongPassword, hashPassword } from './password.js';
import { revokeAllForAdmin } from './sessions.js';

export const RESET_TOKEN_TTL_MINUTES = 30;
const MIN_RESPONSE_MS = 400;

const invalidToken = () =>
  new AppError(400, 'INVALID_RESET_TOKEN', 'Bağlantı geçersiz veya süresi dolmuş.');

/**
 * Talep: hesap varsa ve SMTP hazırsa e-posta gönderir. Gönderim beklenmez (zamanlama sızıntısı yok).
 * @param {string} email
 * @param {{ ipAddress?: string|null, userAgent?: string|null }} ctx
 */
export async function requestPasswordReset(email, ctx) {
  const startedAt = Date.now();
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin?.isActive) return;

    const settings = await getMailSettings();
    if (!isMailConfigured(settings)) {
      await writeAudit({ adminId: admin.id, action: 'PASSWORD_RESET_SMTP_MISSING', ctx });
      return;
    }

    const token = randomToken(32);
    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: { adminId: admin.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          adminId: admin.id,
          tokenHash: sha256Hex(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
          requestIpHash: ctx.ipAddress ? hmacBase64Url(env.CSRF_SECRET, ctx.ipAddress) : null,
        },
      }),
    ]);
    await writeAudit({ adminId: admin.id, action: 'PASSWORD_RESET_REQUESTED', ctx });

    // Token URL fragment'ında: sunucu loglarına ve Referer başlığına düşmez.
    const resetUrl = `${env.PUBLIC_ORIGIN}/admin/reset-password#token=${token}`;
    sendTemplatedEmail({
      key: 'PASSWORD_RESET',
      to: admin.email,
      vars: {
        adminName: admin.displayName ?? admin.email,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
      },
    }).catch((err) =>
      logger.error({ err: { code: err.code } }, 'Şifre sıfırlama e-postası gönderilemedi'),
    );
  } finally {
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(0, MIN_RESPONSE_MS - elapsed) + randomInt(100));
  }
}

/**
 * @param {{ token: string, newPassword: string }} input
 * @param {{ ipAddress?: string|null, userAgent?: string|null }} ctx
 */
export async function resetPassword({ token, newPassword }, ctx) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { admin: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now() || !row.admin.isActive) {
    throw invalidToken();
  }

  assertStrongPassword(newPassword, row.admin);
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) throw invalidToken();
    await tx.adminUser.update({
      where: { id: row.adminId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
  });

  await revokeAllForAdmin(row.adminId, { reason: 'PASSWORD_RESET' });
  await writeAudit({ adminId: row.adminId, action: 'PASSWORD_RESET_COMPLETED', ctx });
}
