// `storage.gc` — StorageDeletionJob worker'ı.
// Başarısız silme 5 kez artan beklemeyle (1, 2, 4, 8, 16 dk) yeniden denenir.
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { storage } from '../storage/index.js';
import { InvalidStorageKeyError } from '../storage/local.js';

export const MAX_ATTEMPTS = 5;
const MINUTE = 60_000;
const KEEP_PROCESSED_MS = 7 * 24 * 60 * MINUTE;

export const backoffMs = (attempts) => 2 ** Math.max(0, attempts - 1) * MINUTE;

/** @returns {Promise<{ processed: number, failed: number }>} */
export async function runStorageGc({ batch = 100, now = new Date() } = {}) {
  const jobs = await prisma.storageDeletionJob.findMany({
    where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS }, nextRunAt: { lte: now } },
    orderBy: { id: 'asc' },
    take: batch,
  });
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await storage.remove(job.storageKey);
      await prisma.storageDeletionJob.update({
        where: { id: job.id },
        data: { processedAt: new Date(), lastError: null },
      });
      processed += 1;
    } catch (err) {
      failed += 1;
      // Geçersiz anahtar tekrar denemeyle düzelmez: doğrudan son denemeye çekilir.
      const attempts = err instanceof InvalidStorageKeyError ? MAX_ATTEMPTS : job.attempts + 1;
      await prisma.storageDeletionJob.update({
        where: { id: job.id },
        data: {
          attempts,
          lastError: String(err.message).slice(0, 500),
          nextRunAt: new Date(now.getTime() + backoffMs(attempts)),
        },
      });
      const level = attempts >= MAX_ATTEMPTS ? 'error' : 'warn';
      logger[level]({ err, key: job.storageKey, attempts }, 'Depo dosyası silinemedi');
    }
  }
  await prisma.storageDeletionJob.deleteMany({
    where: { processedAt: { lt: new Date(now.getTime() - KEEP_PROCESSED_MS) } },
  });
  return { processed, failed };
}
