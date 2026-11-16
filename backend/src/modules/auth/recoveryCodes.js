// FR-AUTH-12 — 2FA kurtarma kodları: 10 adet, tek kullanımlık, SHA-256 ile saklanır.
// Kodlar yüksek entropili (~49 bit) olduğu için yavaş hash gerekmez.
import { randomInt } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { sha256Hex } from '../../lib/hash.js';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // karışan karakterler (0/o, 1/l/i) yok
const CODE_LENGTH = 10;
export const RECOVERY_CODE_COUNT = 10;

/** "abcde-fghjk" biçimi. */
function generateCode() {
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Kullanıcının yazdığı biçimden bağımsız karşılaştırma için normalize eder. */
export const normalizeRecoveryCode = (code) =>
  String(code)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/**
 * Eski kodları siler, yenilerini yazar; düz metin kodları bir kez döndürür.
 * @param {string} adminId
 * @param {import('@prisma/client').Prisma.TransactionClient} [db]
 */
export async function replaceRecoveryCodes(adminId, db = prisma) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateCode);
  await db.recoveryCode.deleteMany({ where: { adminId } });
  await db.recoveryCode.createMany({
    data: codes.map((code) => ({ adminId, codeHash: sha256Hex(normalizeRecoveryCode(code)) })),
  });
  return codes;
}

/**
 * Kullanılmamış kodu tüketir. Eşzamanlı iki kullanım updateMany count kontrolüyle engellenir.
 * @returns {Promise<boolean>}
 */
export async function consumeRecoveryCode(adminId, code) {
  const { count } = await prisma.recoveryCode.updateMany({
    where: { adminId, codeHash: sha256Hex(normalizeRecoveryCode(code)), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}
