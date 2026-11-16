// SRS FR-DSH-02 — ziyaretçi hash'i için günlük tuz. Her İstanbul gününde yenisi üretilir,
// eskisi üzerine yazılır (günler arası izleme yapılamaz). SystemState "daily_salt".
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { istanbulDate } from '../lib/time.js';

const KEY = 'daily_salt';
let cached = null;

/** Bugünün tuzunu döndürür; gün değiştiyse yenisini yazar. */
export async function getDailySalt(now = Date.now()) {
  const day = istanbulDate(now);
  if (cached?.day === day) return cached.salt;

  const row = await prisma.systemState.findUnique({ where: { key: KEY } });
  if (row?.value?.day === day) {
    cached = row.value;
    return cached.salt;
  }
  const value = { day, salt: randomBytes(32).toString('base64url') };
  await prisma.systemState.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  });
  cached = value;
  return value.salt;
}

/** Cron: gece yarısında tuzu döndürür. */
export const rotateDailySalt = (now = Date.now()) => getDailySalt(now);

/** Testler için. */
export const resetDailySaltCache = () => {
  cached = null;
};
