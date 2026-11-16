// FR-AUTH-04, ARCHITECTURE.md §4.1 — refresh ve CSRF cookie'leri.
// `__Host-` öneki: Secure + Path=/ + Domain yok zorunlu. Tarayıcılar localhost'u güvenli bağlam
// saydığı için geliştirmede de Secure çalışır.
import { env } from '../../config/env.js';
import { hmacBase64Url } from '../../lib/hash.js';

export const REFRESH_COOKIE = '__Host-rt';
export const CSRF_COOKIE = '__Host-csrf';

const base = { secure: true, sameSite: 'strict', path: '/' };

/** CSRF token'ı oturum satırına bağlıdır; saklanmaz, her istekte yeniden hesaplanır. */
export const csrfTokenFor = (sessionId) => hmacBase64Url(env.CSRF_SECRET, `csrf:${sessionId}`);

/**
 * rememberMe: kalıcı cookie (ailenin mutlak bitişine kadar); değilse tarayıcı oturumu cookie'si.
 * @param {import('express').Response} res
 * @param {{ refreshToken: string, session: { id: string, rememberMe: boolean, expiresAt: Date } }} params
 */
export function setSessionCookies(res, { refreshToken, session }) {
  const persistence = session.rememberMe ? { expires: session.expiresAt } : {};
  const csrf = csrfTokenFor(session.id);
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, httpOnly: true, ...persistence });
  res.cookie(CSRF_COOKIE, csrf, { ...base, httpOnly: false, ...persistence });
  return csrf;
}

/** @param {import('express').Response} res */
export function clearSessionCookies(res) {
  res.clearCookie(REFRESH_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}
