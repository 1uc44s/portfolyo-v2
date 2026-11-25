// kimlik doğrulama ve hesap formları (istemci + sunucu aynı şema).
import { z } from 'zod';

/** Cloudflare Turnstile — iletişim formu ve admin girişi. */
export const CAPTCHA_REQUIRED_MESSAGE = 'Doğrulamayı tamamla.';
export const turnstileTokenField = () =>
  z
    .string({ error: CAPTCHA_REQUIRED_MESSAGE })
    .min(1, CAPTCHA_REQUIRED_MESSAGE)
    .max(2048, CAPTCHA_REQUIRED_MESSAGE);

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const emailField = () =>
  z
    .string({ error: 'E-posta zorunlu.' })
    .trim()
    .toLowerCase()
    .max(254, 'E-posta en fazla 254 karakter olabilir.')
    .pipe(z.email('Geçerli bir e-posta adresi gir.'));

/** Yeni şifre: uzunluk kuralı. Güç kontrolü (zxcvbn) sunucuda ayrıca yapılır. */
export const newPasswordField = () =>
  z
    .string({ error: 'Şifre zorunlu.' })
    .min(PASSWORD_MIN_LENGTH, `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`)
    .max(PASSWORD_MAX_LENGTH, `Şifre en fazla ${PASSWORD_MAX_LENGTH} karakter olabilir.`);

/** Mevcut şifre: yalnızca boş olmamalı (eski politikayla oluşturulmuş olabilir). */
const currentPasswordField = () =>
  z
    .string({ error: 'Mevcut şifre zorunlu.' })
    .min(1, 'Mevcut şifre zorunlu.')
    .max(PASSWORD_MAX_LENGTH);

const totpCode = () =>
  z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Kod 6 haneli olmalı.');
const recoveryCode = () =>
  z.string().trim().min(8, 'Kurtarma kodu geçersiz.').max(32, 'Kurtarma kodu geçersiz.');

/** code veya recoveryCode'dan tam olarak biri. */
const secondFactor = (shape) =>
  z
    .object({ ...shape, code: totpCode().optional(), recoveryCode: recoveryCode().optional() })
    .strict()
    .refine((v) => Boolean(v.code) !== Boolean(v.recoveryCode), {
      message: 'Doğrulama kodu veya kurtarma kodundan birini gir.',
      path: ['code'],
    });

export const loginSchema = z
  .object({
    email: emailField(),
    password: currentPasswordField(),
    rememberMe: z.boolean().default(false),
    turnstileToken: turnstileTokenField(),
  })
  .strict();

export const mfaVerifySchema = secondFactor({ mfaToken: z.string().min(1).max(2048) });

export const forgotPasswordSchema = z.object({ email: emailField() }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Bağlantı geçersiz veya süresi dolmuş.'),
    newPassword: newPasswordField(),
  })
  .strict();

export const changePasswordSchema = z
  .object({ currentPassword: currentPasswordField(), newPassword: newPasswordField() })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'Yeni şifre mevcut şifreyle aynı olamaz.',
    path: ['newPassword'],
  });

export const changeEmailSchema = z
  .object({ newEmail: emailField(), currentPassword: currentPasswordField() })
  .strict();

export const profileSchema = z
  .object({
    displayName: z.string().trim().max(80, 'Görünen ad en fazla 80 karakter olabilir.').nullable(),
  })
  .strict();

export const twoFactorSetupSchema = z.object({ currentPassword: currentPasswordField() }).strict();
export const twoFactorEnableSchema = z.object({ code: totpCode() }).strict();
export const twoFactorDisableSchema = secondFactor({ currentPassword: currentPasswordField() });
export const recoveryRegenerateSchema = z
  .object({ currentPassword: currentPasswordField(), code: totpCode() })
  .strict();

export const mailSettingsSchema = z
  .object({
    smtpHost: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(/^[A-Za-z0-9.-]+$/, 'Geçerli bir sunucu adı gir.')
      .nullable(),
    smtpPort: z.number().int().min(1).max(65535).nullable(),
    smtpSecure: z.boolean(),
    smtpUser: z.string().trim().max(255).nullable(),
    // undefined = değiştirme, null = sil, string = yeni değer
    appPassword: z.string().min(1).max(256).nullable().optional(),
    fromName: z.string().trim().max(80).nullable(),
    fromEmail: emailField().nullable(),
    notifyOnContact: z.boolean(),
    notifyEmail: emailField().nullable(),
  })
  .strict();

export const mailTestSchema = z.object({ to: emailField().optional() }).strict();
