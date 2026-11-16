// FR-AUTH-12/13 — RFC 6238 TOTP (SHA-1, 6 hane, 30 sn) ve RFC 4648 Base32.
// Harici kütüphane yerine node:crypto: küçük, denetlenebilir ve adım bazlı replay kontrolü verir.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

/** @param {Buffer} buffer */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/** @param {string} input */
export function base32Decode(input) {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Geçersiz Base32 karakteri.');
    value = ((value << 5) | index) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bit rastgele secret (Base32). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** @param {number} [nowMs] */
export const currentTotpStep = (nowMs = Date.now()) =>
  Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);

/**
 * RFC 4226 HOTP.
 * @param {Buffer} key @param {number} counter @param {number} [digits]
 */
export function hotp(key, counter, digits = TOTP_DIGITS) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Kodu doğrular; ±window adım toleransı. Daha önce kullanılmış adım (≤ lastStep) reddedilir.
 * @param {string} secretBase32
 * @param {string} code
 * @param {{ nowMs?: number, window?: number, lastStep?: number|bigint|null }} [options]
 * @returns {number|null} eşleşen adım veya null
 */
export function verifyTotp(
  secretBase32,
  code,
  { nowMs = Date.now(), window = 1, lastStep = null } = {},
) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const key = base32Decode(secretBase32);
  const current = currentTotpStep(nowMs);
  const minAllowed = lastStep == null ? -Infinity : Number(lastStep) + 1;
  const expected = Buffer.from(String(code));
  let matched = null;
  // Tüm pencere taranır (erken çıkış yok) — zamanlama farkını azaltır.
  for (let step = current - window; step <= current + window; step += 1) {
    const candidate = Buffer.from(hotp(key, step));
    if (timingSafeEqual(candidate, expected) && step >= minAllowed && matched === null) {
      matched = step;
    }
  }
  return matched;
}

/**
 * Authenticator uygulamaları için otpauth URI.
 * @param {{ secret: string, account: string, issuer: string }} params
 */
export function buildOtpauthUrl({ secret, account, issuer }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query}`;
}
