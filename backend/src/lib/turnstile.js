// Cloudflare Turnstile sunucu doğrulaması (fail-closed). Gizli anahtar loglanmaz.
import { env } from '../config/env.js';
import { AppError } from './httpError.js';
import { logger } from './logger.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

const unavailable = () =>
  new AppError(
    503,
    'CAPTCHA_UNAVAILABLE',
    'Doğrulama servisine şu an ulaşılamıyor. Biraz sonra tekrar dene.',
  );

/** @param {{ token: string, ip?: string }} input @returns {Promise<boolean>} */
async function cloudflareVerify({ token, ip }) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  let res;
  try {
    res = await fetch(SITEVERIFY, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ errName: err?.name }, 'Turnstile doğrulama servisine ulaşılamadı');
    throw unavailable();
  }
  if (!res.ok) {
    logger.warn({ status: res.status }, 'Turnstile doğrulama servisi hata döndü');
    throw unavailable();
  }
  const data = await res.json().catch(() => null);
  return data?.success === true;
}

let verifier = cloudflareVerify;

/** Testler için doğrulayıcıyı değiştirir (null → gerçek servis). */
export function setCaptchaVerifier(fn) {
  verifier = fn ?? cloudflareVerify;
}

/** @param {{ token: string, ip?: string }} input @returns {Promise<boolean>} */
export const verifyCaptcha = (input) => verifier(input);

export const publicCaptchaConfig = () => ({
  provider: 'turnstile',
  siteKey: env.TURNSTILE_SITE_KEY,
});
