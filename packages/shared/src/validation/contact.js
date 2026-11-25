// iletişim formu (istemci + sunucu aynı şema) ve gelen kutusu sorguları.
// Telefonun E.164 geçerliliği sunucuda libphonenumber-js ile ayrıca denetlenir.
import { z } from 'zod';
import { emailField, turnstileTokenField } from './auth.js';

export const CONTACT_LIMITS = Object.freeze({
  firstName: 60,
  lastName: 60,
  subjectMin: 3,
  subject: 120,
  messageMin: 10,
  message: 4000,
});

// eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek temizleniyor
const INLINE_CONTROL = /[\u0000-\u001F\u007F]/g;
// eslint-disable-next-line no-control-regex -- satır sonu (\n) ve sekme korunur
const BLOCK_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const cleanInline = (v) => v.replace(INLINE_CONTROL, ' ').replace(/\s+/g, ' ').trim();
const cleanBlock = (v) =>
  v
    .replace(/\r\n?/g, '\n')
    .replace(BLOCK_CONTROL, '')
    .replace(/[ \t]+$/gm, '')
    .trim();

const text = ({ required, min = 1, max, minMessage, maxMessage, multiline = false }) =>
  z
    .string({ error: required })
    .transform(multiline ? cleanBlock : cleanInline)
    .pipe(
      z
        .string()
        .min(1, required)
        .min(min, minMessage ?? required)
        .max(max, maxMessage),
    );

export const PHONE_INVALID_MESSAGE = 'Geçerli bir telefon numarası gir.';
const PHONE_CHARS = /^\+?[0-9 ()-]+$/;

export const phoneField = () =>
  z
    .string({ error: 'Telefon zorunlu.' })
    .trim()
    .min(1, 'Telefon zorunlu.')
    .max(20, PHONE_INVALID_MESSAGE)
    .refine((v) => PHONE_CHARS.test(v), PHONE_INVALID_MESSAGE)
    .refine((v) => {
      const digits = v.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    }, PHONE_INVALID_MESSAGE);

/** Opsiyonel telefon: boş / yalnızca boşluk → null; doluysa phoneField kuralları. */
export const optionalPhoneField = () =>
  z
    .preprocess(
      (v) => (v == null || (typeof v === 'string' && v.trim() === '') ? undefined : v),
      phoneField().optional(),
    )
    .transform((v) => v ?? null);

export const contactSchema = z
  .object({
    firstName: text({
      required: 'Ad zorunlu.',
      max: CONTACT_LIMITS.firstName,
      maxMessage: `Ad en fazla ${CONTACT_LIMITS.firstName} karakter olabilir.`,
    }),
    lastName: text({
      required: 'Soyad zorunlu.',
      max: CONTACT_LIMITS.lastName,
      maxMessage: `Soyad en fazla ${CONTACT_LIMITS.lastName} karakter olabilir.`,
    }),
    phone: optionalPhoneField(),
    email: emailField(),
    subject: text({
      required: 'Konu zorunlu.',
      min: CONTACT_LIMITS.subjectMin,
      max: CONTACT_LIMITS.subject,
      minMessage: `Konu en az ${CONTACT_LIMITS.subjectMin} karakter olmalı.`,
      maxMessage: `Konu en fazla ${CONTACT_LIMITS.subject} karakter olabilir.`,
    }),
    message: text({
      required: 'Mesaj zorunlu.',
      min: CONTACT_LIMITS.messageMin,
      max: CONTACT_LIMITS.message,
      minMessage: `Mesaj en az ${CONTACT_LIMITS.messageMin} karakter olmalı.`,
      maxMessage: `Mesaj en fazla ${CONTACT_LIMITS.message} karakter olabilir.`,
      multiline: true,
    }),
    turnstileToken: turnstileTokenField(),
    // Honeypot: insan için görünmez. Doluysa sunucu sessizce başarı döner.
    website: z.string().max(200).optional(),
  })
  .strict();

/** Honeypot alanı dolu mu? Şemadan önce, ham gövdede bakılır (bot diğer alanları bozsa da). */
export const isHoneypotFilled = (body) =>
  typeof body?.website === 'string' && body.website.trim().length > 0;

export const CONTACT_VIEWS = Object.freeze(['inbox', 'unread', 'pending', 'replied', 'spam']);

export const contactListQuerySchema = z
  .object({
    view: z.enum(CONTACT_VIEWS).default('inbox'),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const contactPatchSchema = z
  .object({
    isRead: z.boolean().optional(),
    status: z.enum(['PENDING', 'REPLIED']).optional(),
    isSpam: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });
