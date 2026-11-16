// SEC-18, RULES.md §5.5 — hash, HMAC, sabit zamanlı karşılaştırma, rastgele token.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** @param {string} value */
export const sha256Hex = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

/** @param {string} secret @param {string} value */
export const hmacBase64Url = (secret, value) =>
  createHmac('sha256', secret).update(value, 'utf8').digest('base64url');

/** Kriptografik rastgele, URL-güvenli token. @param {number} bytes */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/**
 * Sabit zamanlı string karşılaştırması. Uzunluk farkı erken false döner (uzunluk sır değil).
 * @param {unknown} a @param {unknown} b
 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}
