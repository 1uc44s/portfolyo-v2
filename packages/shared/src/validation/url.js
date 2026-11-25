// harici URL'ler: yalnızca http/https, kullanıcı bilgisi yok, ≤ 2048 karakter.
import { z } from 'zod';

export const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** @param {unknown} value */
export function isSafeHttpUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH)
    return false;
  // eslint-disable-next-line no-control-regex -- kontrol karakterleri bilerek reddediliyor
  if (/[\u0000-\u001F\u007F\s]/.test(value)) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return false;
  if (url.username || url.password) return false;
  return url.hostname.length > 0;
}

export const httpUrl = () =>
  z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, 'Bağlantı en fazla 2048 karakter olabilir.')
    .refine(isSafeHttpUrl, 'Yalnızca geçerli http ve https adresleri kabul edilir.');
