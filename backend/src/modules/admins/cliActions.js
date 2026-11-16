// FR-SETUP-01..04, ADMIN.md §2.3 — sunucu üzerinde çalışan yönetici CLI işlemleri.
// HTTP üzerinden kurulum ucu YOKTUR; bu fonksiyonlar yalnızca backend/scripts/* tarafından çağrılır.
import { emailField, newPasswordField, ROLES } from '@vasquez/shared';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { assertStrongPassword, generateTemporaryPassword, hashPassword } from '../auth/password.js';
import { revokeAllForAdmin } from '../auth/sessions.js';

const CLI_CTX = { ipAddress: null, userAgent: 'cli' };

export class CliError extends Error {}

async function findByEmail(rawEmail) {
  const email = emailField().parse(rawEmail);
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) throw new CliError(`Yönetici bulunamadı: ${email}`);
  return admin;
}

/**
 * İlk (veya --force ile ek) SUPER_ADMIN. Hesap mustChangePassword=true ile açılır.
 * @param {{ email: string, password: string, displayName?: string|null, force?: boolean }} input
 */
export async function createSuperAdmin({
  email: rawEmail,
  password,
  displayName = null,
  force = false,
}) {
  const email = emailField().parse(rawEmail);
  newPasswordField().parse(password);
  assertStrongPassword(password, { email, displayName }, 'password');

  const existingSuper = await prisma.adminUser.count({ where: { role: ROLES.SUPER_ADMIN } });
  if (existingSuper > 0 && !force) {
    throw new CliError(
      'Sistemde zaten bir SÜPER ADMİN var. Ek süper admin için --force kullan (mevcut hesaplar değişmez).',
    );
  }
  if (await prisma.adminUser.findUnique({ where: { email } })) {
    throw new CliError(`Bu e-posta zaten kayıtlı: ${email}`);
  }

  const admin = await prisma.adminUser.create({
    data: {
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: ROLES.SUPER_ADMIN,
      mustChangePassword: true,
    },
  });
  await writeAudit({
    adminId: admin.id,
    action: 'ADMIN_CREATED',
    entityType: 'AdminUser',
    entityId: admin.id,
    metadata: { actor: 'cli', role: admin.role, force },
    ctx: CLI_CTX,
  });
  return { id: admin.id, email: admin.email };
}

/** SMTP yokken kurtarma: geçici şifre üretir, tüm oturumları kapatır. */
export async function resetAdminPassword(rawEmail) {
  const admin = await findByEmail(rawEmail);
  const temporaryPassword = generateTemporaryPassword();
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeAllForAdmin(admin.id, { reason: 'PASSWORD_RESET' });
  await writeAudit({
    adminId: admin.id,
    action: 'PASSWORD_RESET_COMPLETED',
    metadata: { actor: 'cli' },
    ctx: CLI_CTX,
  });
  return { email: admin.email, temporaryPassword };
}

/** Kayıp 2FA cihazı: 2FA kapatılır, kurtarma kodları silinir, oturumlar kapanır. */
export async function resetAdminTwoFactor(rawEmail) {
  const admin = await findByEmail(rawEmail);
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpPendingSecretEnc: null,
        lastTotpStep: null,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { adminId: admin.id } }),
  ]);
  await revokeAllForAdmin(admin.id, { reason: '2FA_CHANGED' });
  await writeAudit({
    adminId: admin.id,
    action: '2FA_RESET_BY_ADMIN',
    metadata: { actor: 'cli' },
    ctx: CLI_CTX,
  });
  return { email: admin.email };
}

/** Geçici giriş kilidini kaldırır. */
export async function unlockAdmin(rawEmail) {
  const admin = await findByEmail(rawEmail);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
  await writeAudit({
    adminId: admin.id,
    action: 'ADMIN_UPDATED',
    metadata: { actor: 'cli', unlocked: true },
    ctx: CLI_CTX,
  });
  return { email: admin.email };
}

export const DEV_PASSWORD_MIN_LENGTH = 8;

/**
 * Yalnızca geliştirme (ADMIN.md §2.3): hesap yoksa SUPER_ADMIN oluşturur, varsa şifresini değiştirir.
 * Uzunluk kuralı 8; zxcvbn güç kontrolü aynen. Prod'da reddedilir.
 * @param {{ email: string, password: string, nodeEnv?: string }} input
 */
export async function devSetAdmin({ email: rawEmail, password, nodeEnv = process.env.NODE_ENV }) {
  if (nodeEnv === 'production') {
    throw new CliError('Bu komut yalnızca geliştirme ortamında çalışır.');
  }
  const email = emailField().parse(rawEmail);
  if (typeof password !== 'string' || password.length < DEV_PASSWORD_MIN_LENGTH) {
    throw new CliError(`Şifre en az ${DEV_PASSWORD_MIN_LENGTH} karakter olmalı.`);
  }
  if (password.length > 128) throw new CliError('Şifre en fazla 128 karakter olabilir.');
  assertStrongPassword(password, { email }, 'password');

  const passwordHash = await hashPassword(password);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  const admin = existing
    ? await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
      })
    : await prisma.adminUser.create({
        data: { email, passwordHash, role: ROLES.SUPER_ADMIN, mustChangePassword: false },
      });
  if (existing) await revokeAllForAdmin(admin.id, { reason: 'PASSWORD_RESET' });
  await writeAudit({
    adminId: admin.id,
    action: existing ? 'PASSWORD_RESET_COMPLETED' : 'ADMIN_CREATED',
    entityType: 'AdminUser',
    entityId: admin.id,
    metadata: { actor: 'cli', dev: true },
    ctx: CLI_CTX,
  });
  return { email, created: !existing };
}
