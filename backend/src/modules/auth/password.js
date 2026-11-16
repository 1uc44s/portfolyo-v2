// SEC-01, SEC-18, FR-AUTH-08 — Argon2id, zamanlama eşitleme, şifre gücü.
import argon2 from 'argon2';
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommon from '@zxcvbn-ts/language-common';
import { ValidationError } from '../../lib/httpError.js';
import { randomToken } from '../../lib/hash.js';

// OWASP asgari Argon2id parametreleri (SRS SEC-01); sunucu kapasitesine göre artırılabilir.
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };
const MIN_STRENGTH_SCORE = 3;

const zxcvbn = new ZxcvbnFactory({
  dictionary: { ...zxcvbnCommon.dictionary },
  graphs: zxcvbnCommon.adjacencyGraphs,
});

/** @param {string} password */
export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);

/** @param {string} hash @param {string} password */
export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise;
/**
 * Bilinmeyen e-posta için aynı maliyette sahte doğrulama (hesap numaralandırma önlemi).
 * @param {string} password
 */
export async function verifyDummyPassword(password) {
  dummyHashPromise ??= hashPassword(randomToken(24));
  await verifyPassword(await dummyHashPromise, password);
  return false;
}

/**
 * Yeni şifreyi güç açısından doğrular; zayıfsa 422 fırlatır.
 * @param {string} password
 * @param {{ email?: string|null, displayName?: string|null }} [context]
 * @param {string} [field]
 */
export function assertStrongPassword(password, context = {}, field = 'newPassword') {
  const email = context.email?.toLowerCase() ?? '';
  if (email && password.toLowerCase() === email) {
    throw new ValidationError([{ path: field, message: 'Şifre e-posta adresinle aynı olamaz.' }]);
  }
  const userInputs = [email, email.split('@')[0], context.displayName ?? '', 'vasquez'].filter(
    Boolean,
  );
  const { score } = zxcvbn.check(password, userInputs);
  if (score < MIN_STRENGTH_SCORE) {
    throw new ValidationError([
      {
        path: field,
        message:
          'Şifre çok tahmin edilebilir. Daha uzun ve kişisel bilgi içermeyen bir ifade dene.',
      },
    ]);
  }
}

/** Yönetici için geçici şifre (CLI, yönetici oluşturma). 20 karakter, URL-güvenli. */
export const generateTemporaryPassword = () => randomToken(15);
