// F14 — iletişim formu (FR-CNT-01..06) ve gelen kutusu (FR-MSG-01..07, ROUTES.md §4.11).
// Kişisel veri: mesaj içeriği/e-posta/telefon loglara ve audit metadata'sına yazılmaz.
import { createHmac } from 'node:crypto';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { CAPTCHA_REQUIRED_MESSAGE, PHONE_INVALID_MESSAGE } from '@vasquez/shared';
import { env } from '../../config/env.js';
import { getDailySalt } from '../../jobs/dailySalt.js';
import { NotFoundError, ValidationError } from '../../lib/httpError.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { verifyCaptcha } from '../../lib/turnstile.js';
import { render } from '../../mail/templateEngine.js';
import {
  getMailSettings,
  getSiteName,
  isMailConfigured,
  sendTemplatedEmail,
} from '../../mail/transport.js';
import { writeAudit } from '../audit/service.js';

export const RETENTION_MONTHS = 12;
export const PREVIEW_LENGTH = 140;
export const CAPTCHA_FAILED_MESSAGE = 'Doğrulama başarısız oldu. Tekrar dene.';

/** "0532 123 45 67" → "+905321234567"; geçersizse null. Varsayılan bölge TR. */
export function normalizePhone(input) {
  const parsed = parsePhoneNumberFromString(String(input ?? ''), 'TR');
  return parsed?.isValid() ? parsed.number : null;
}

/** Takvim ayı ekler; ay sonu taşmasında ayın son günü (31 Mart + 1 ay = 30 Nisan). */
export function addMonths(date, months) {
  const out = new Date(date);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

const ipHashOf = async (ip) =>
  createHmac('sha256', await getDailySalt())
    .update(String(ip ?? ''), 'utf8')
    .digest('hex');

/** Şema sonrası: telefon (varsa) E.164'e çevrilir; geçersizse alan bazlı 422. Boşsa null. */
export function finalizeContact(input) {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone)
    throw new ValidationError([{ path: 'phone', message: PHONE_INVALID_MESSAGE }]);
  const { turnstileToken: _token, website: _hp, ...rest } = input;
  return { ...rest, phone };
}

export async function assertCaptcha(token, ip) {
  if (!token) {
    throw new ValidationError([{ path: 'turnstileToken', message: CAPTCHA_REQUIRED_MESSAGE }]);
  }
  const ok = await verifyCaptcha({ token, ip });
  if (!ok) {
    throw new ValidationError([{ path: 'turnstileToken', message: CAPTCHA_FAILED_MESSAGE }]);
  }
}

/**
 * Bildirim alıcısı: ayarlı adres; boşsa ilk aktif süper admin hesabının e-postası (arayüzdeki
 * "boş bırakırsan hesabının e-posta adresine gider"). Gönderen adresi (ör. noreply@…) son çare.
 */
async function notifyRecipient(settings) {
  if (settings.notifyEmail) return settings.notifyEmail;
  const admin = await prisma.adminUser.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  });
  return admin?.email ?? settings.fromEmail;
}

/** FR-MSG-06 — opsiyonel e-posta bildirimi. Hata yutulur; içerik loglanmaz. */
export async function notifyNewMessage(message) {
  try {
    const settings = await getMailSettings();
    if (!settings?.notifyOnContact || !isMailConfigured(settings)) return false;
    await sendTemplatedEmail({
      key: 'CONTACT_NOTIFICATION',
      to: await notifyRecipient(settings),
      replyTo: message.email,
      vars: {
        senderFullName: `${message.firstName} ${message.lastName}`,
        senderEmail: message.email,
        senderPhone: message.phone ?? 'belirtilmedi',
        subject: message.subject,
        message: message.message,
        adminUrl: `${env.PUBLIC_ORIGIN}/admin/messages?id=${message.id}`,
      },
    });
    return true;
  } catch (err) {
    logger.warn({ errCode: err?.code ?? err?.name }, 'İletişim bildirimi gönderilemedi');
    return false;
  }
}

/** Testler için değiştirilebilir yan etki. */
export const hooks = {
  onStored: (message) => {
    setImmediate(() => void notifyNewMessage(message));
  },
};

/** Doğrulanmış mesajı kaydeder ve (açıksa) bildirimi arka planda gönderir. */
export async function storeContact(data, { ip, userAgent, now = new Date() }) {
  const message = await prisma.contactMessage.create({
    data: {
      ...data,
      ipHash: await ipHashOf(ip),
      userAgent: userAgent?.slice(0, 400) || null,
      retentionUntil: addMonths(now, RETENTION_MONTHS),
      createdAt: now,
    },
  });
  hooks.onStored(message);
  return message;
}

// ───────────────────────────── Admin ─────────────────────────────

const VIEW_WHERE = {
  inbox: { isSpam: false },
  unread: { isSpam: false, isRead: false },
  pending: { isSpam: false, status: 'PENDING' },
  replied: { isSpam: false, status: 'REPLIED' },
  spam: { isSpam: true },
};

const ORDER = [{ isRead: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }];

const preview = (text) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
};

const summary = (m) => ({
  id: m.id,
  firstName: m.firstName,
  lastName: m.lastName,
  email: m.email,
  subject: m.subject,
  preview: preview(m.message),
  isRead: m.isRead,
  status: m.status,
  isSpam: m.isSpam,
  createdAt: m.createdAt,
});

const detail = (m) => ({
  ...summary(m),
  phone: m.phone,
  message: m.message,
  readAt: m.readAt,
  repliedAt: m.repliedAt,
  retentionUntil: m.retentionUntil,
});

export async function listMessages({ view, q, page, limit }) {
  const where = { ...VIEW_WHERE[view] };
  if (q) {
    const contains = { contains: q, mode: 'insensitive' };
    where.OR = [
      { firstName: contains },
      { lastName: contains },
      { email: contains },
      { subject: contains },
    ];
  }
  const [total, rows] = await prisma.$transaction([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: ORDER,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items: rows.map(summary), meta: { total, page, limit } };
}

export const unreadCount = () =>
  prisma.contactMessage.count({ where: { isRead: false, isSpam: false } });

async function findOr404(id) {
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) throw new NotFoundError('Mesaj bulunamadı.');
  return message;
}

/** FR-MSG-02 — açınca okundu. */
export async function openMessage(id) {
  const message = await findOr404(id);
  if (message.isRead) return detail(message);
  return detail(
    await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    }),
  );
}

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'ContactMessage', entityId, metadata, ctx });

/** FR-MSG-03 — PENDING ↔ REPLIED; okundu ve spam bağımsız bayraklar. */
export async function updateMessage(id, input, { adminId, ctx }) {
  const current = await findOr404(id);
  const data = {};
  if (input.isRead !== undefined) {
    data.isRead = input.isRead;
    data.readAt = input.isRead ? (current.readAt ?? new Date()) : null;
  }
  if (input.status !== undefined) {
    data.status = input.status;
    data.repliedAt = input.status === 'REPLIED' ? (current.repliedAt ?? new Date()) : null;
  }
  if (input.isSpam !== undefined) data.isSpam = input.isSpam;
  const message = await prisma.contactMessage.update({ where: { id }, data });
  await audit('CONTACT_MESSAGE_UPDATED', { adminId, ctx, entityId: id, metadata: input });
  return detail(message);
}

export async function deleteMessage(id, { adminId, ctx }) {
  await findOr404(id);
  await prisma.contactMessage.delete({ where: { id } });
  await audit('CONTACT_MESSAGE_DELETED', { adminId, ctx, entityId: id });
}

async function ownerName() {
  const hero = await prisma.heroSettings.findUnique({
    where: { id: 1 },
    select: { displayName: true },
  });
  return hero?.displayName || (await getSiteName());
}

const plain = (template, vars) => render(template ?? '', vars).trim();

/** FR-MSG-04 — şablonlu mailto linki sunucuda üretilir. WhatsApp yanıtı yok (CMS.md §6). */
export async function replyLinks(id, { adminId, ctx }) {
  const message = await findOr404(id);
  const [template, siteName, owner] = await Promise.all([
    prisma.messageTemplate.findUnique({ where: { key: 'CONTACT_REPLY_EMAIL' } }),
    getSiteName(),
    ownerName(),
  ]);
  const vars = {
    siteName,
    ownerName: owner,
    firstName: message.firstName,
    lastName: message.lastName,
    subject: message.subject,
  };
  const subject = plain(template?.subject ?? 'Re: {{subject}}', vars).replace(/[\r\n]+/g, ' ');
  const body = plain(template?.body, vars);
  const mailto =
    `mailto:${message.email}?subject=${encodeURIComponent(subject)}` +
    (body ? `&body=${encodeURIComponent(body)}` : '');
  await audit('CONTACT_REPLY_LINK_OPENED', { adminId, ctx, entityId: id });
  return { mailto };
}

/** FR-MSG-05 — saklama süresi dolanları kalıcı siler (günlük iş). */
export async function purgeExpiredMessages(now = new Date()) {
  const { count } = await prisma.contactMessage.deleteMany({
    where: { retentionUntil: { lt: now } },
  });
  if (count > 0) {
    await writeAudit({
      action: 'CONTACT_RETENTION_PURGED',
      entityType: 'ContactMessage',
      metadata: { count },
      ctx: { ipAddress: null, userAgent: null },
    });
  }
  return count;
}
