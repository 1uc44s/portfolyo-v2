// CMS.md §5.4 — SMTP gönderimi. Uygulama anahtarı yalnızca gönderim anında çözülür.
import nodemailer from 'nodemailer';
import { decrypt } from '../lib/crypto.js';
import { prisma } from '../lib/prisma.js';
import { renderEmail } from './templateEngine.js';

let transportFactory = (options) => nodemailer.createTransport(options);

/** Testler için gönderim katmanını değiştirir. */
export function setMailTransportFactory(factory) {
  transportFactory = factory ?? ((options) => nodemailer.createTransport(options));
}

export const getMailSettings = () => prisma.mailSettings.findUnique({ where: { id: 1 } });

/** @param {Awaited<ReturnType<typeof getMailSettings>>} settings */
export const isMailConfigured = (settings) =>
  Boolean(settings?.smtpHost && settings?.smtpPort && settings?.fromEmail);

function createTransport(settings) {
  const pass = settings.appPasswordEnc ? decrypt(settings.appPasswordEnc) : undefined;
  return transportFactory({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser && pass ? { user: settings.smtpUser, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export async function getSiteName() {
  const site = await prisma.siteSettings.findUnique({
    where: { id: 1 },
    select: { navbarTitle: true },
  });
  return site?.navbarTitle ?? 'vasquez';
}

/**
 * Şablonlu e-posta gönderir. Yapılandırma yoksa MAIL_NOT_CONFIGURED fırlatır.
 * @param {{ key: string, to: string, vars?: Record<string, unknown>, replyTo?: string }} params
 */
export async function sendTemplatedEmail({ key, to, vars = {}, replyTo }) {
  const settings = await getMailSettings();
  if (!isMailConfigured(settings)) {
    const err = new Error('E-posta gönderimi yapılandırılmamış.');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  const template = await prisma.messageTemplate.findUnique({ where: { key } });
  if (!template) throw new Error(`Şablon bulunamadı: ${key}`);

  const siteName = await getSiteName();
  const message = renderEmail(template, { siteName, ...vars });
  const from = settings.fromName
    ? { name: settings.fromName, address: settings.fromEmail }
    : settings.fromEmail;

  await createTransport(settings).sendMail({ from, to, replyTo, ...message });
}
