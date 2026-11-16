// SEC-17, DATABASE.md §1 kural 7 — AES-256-GCM; biçim: v1:<iv>:<tag>:<ciphertext> (base64url).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;

/** @param {Buffer} key 32 byte */
export function createCipherBox(key) {
  if (key.length !== 32) throw new Error('Şifreleme anahtarı 32 byte olmalı.');

  /** @param {string} plaintext */
  function encrypt(plaintext) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, ciphertext]
      .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
      .join(':');
  }

  /** @param {string} payload */
  function decrypt(payload) {
    const parts = String(payload).split(':');
    if (parts.length !== 4 || parts[0] !== VERSION)
      throw new Error('Desteklenmeyen şifreli veri biçimi.');
    const [, iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  return {
    encrypt,
    decrypt,
    encryptJson: (value) => encrypt(JSON.stringify(value)),
    decryptJson: (payload) => JSON.parse(decrypt(payload)),
  };
}

export const { encrypt, decrypt, encryptJson, decryptJson } = createCipherBox(
  Buffer.from(env.APP_ENCRYPTION_KEY, 'base64'),
);
