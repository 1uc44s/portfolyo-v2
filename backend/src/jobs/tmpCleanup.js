// SRS FR-MED-12, ARCHITECTURE.md §9 `uploads.tmpCleanup` — 24 saatten eski geçici dosyalar.
// Kuyruk kaynakları (tmp/queue/<assetId>.mp4) yalnızca bekleyen işi yoksa silinir.
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { QUEUE_DIR, TMP_DIR } from '../storage/index.js';

export const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function oldFiles(dir, cutoff) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const result = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(dir, entry.name);
    const info = await stat(full).catch(() => null);
    if (info && info.mtimeMs < cutoff) result.push({ full, name: entry.name });
  }
  return result;
}

/** @returns {Promise<number>} silinen dosya sayısı */
export async function cleanupTmp({ now = Date.now() } = {}) {
  const cutoff = now - TMP_MAX_AGE_MS;
  let removed = 0;
  for (const file of await oldFiles(TMP_DIR, cutoff)) {
    await rm(file.full, { force: true });
    removed += 1;
  }
  const queued = await oldFiles(QUEUE_DIR, cutoff);
  if (queued.length > 0) {
    const ids = queued.map((f) => f.name.split('.')[0]);
    const active = await prisma.mediaAsset.findMany({
      where: {
        id: { in: ids.filter((id) => /^[0-9a-f-]{36}$/.test(id)) },
        processingStatus: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { id: true },
    });
    const keep = new Set(active.map((a) => a.id));
    for (const file of queued) {
      if (keep.has(file.name.split('.')[0])) continue;
      await rm(file.full, { force: true });
      removed += 1;
    }
  }
  if (removed > 0) logger.info({ removed }, 'Geçici yükleme dosyaları temizlendi');
  return removed;
}
