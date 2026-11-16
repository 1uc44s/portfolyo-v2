// SRS FR-MED-06, ARCHITECTURE.md §8 — DB tabanlı video kuyruğu. Eşzamanlılık 1; iş
// `FOR UPDATE SKIP LOCKED` ile alınır; açılışta PROCESSING kalmış işler PENDING'e döner.
import { rm } from 'node:fs/promises';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { storage } from '../storage/index.js';
import { writeAudit } from '../modules/audit/service.js';
import { processVideo } from '../modules/media/process.js';
import { persistOutputs, removeKeys } from '../modules/media/service.js';

/** Sıradaki PENDING videoyu atomik olarak PROCESSING yapar; yoksa null. */
export async function claimNextVideo() {
  const rows = await prisma.$queryRaw`
    UPDATE media_assets SET processing_status = 'PROCESSING', updated_at = now()
    WHERE id = (
      SELECT id FROM media_assets
      WHERE processing_status = 'PENDING' AND media_type = 'VIDEO'
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/** Yarım kalan işler (süreç çöktü/kapandı) yeniden kuyruğa. */
export async function recoverInterruptedJobs() {
  const { count } = await prisma.mediaAsset.updateMany({
    where: { processingStatus: 'PROCESSING', mediaType: 'VIDEO' },
    data: { processingStatus: 'PENDING' },
  });
  if (count > 0) logger.warn({ count }, 'Yarım kalan video işleri kuyruğa geri alındı');
  return count;
}

async function markFailed(asset, err) {
  const message = String(err?.message ?? err).slice(0, 500);
  await prisma.mediaAsset.updateMany({
    where: { id: asset.id },
    data: { processingStatus: 'FAILED', processingError: message },
  });
  logger.error({ err, assetId: asset.id }, 'Video işlenemedi');
  await writeAudit({
    action: 'MEDIA_PROCESSING_FAILED',
    entityType: 'MediaAsset',
    entityId: asset.id,
    metadata: { kind: asset.kind, error: message },
  });
}

const pickVariants = (keys) =>
  Object.fromEntries(['v1080', 'v720'].filter((r) => keys[r]).map((r) => [r, keys[r]]));

export async function processVideoAsset(id) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return;
  const { sourceKey, variants: _oldVariants, ...restMeta } = asset.metadata ?? {};
  let result;
  try {
    result = await processVideo({
      kind: asset.kind,
      sourcePath: storage.resolveKey(sourceKey),
      durationSec: (asset.durationMs ?? 0) / 1000,
    });
    const { keys, totalBytes } = await persistOutputs(asset.kind, asset.id, result.outputs);
    const { count } = await prisma.mediaAsset.updateMany({
      where: { id, processingStatus: 'PROCESSING' },
      data: {
        storageKey: keys.main,
        posterKey: keys.poster,
        thumbnailKey: keys.thumb,
        totalBytes,
        width: result.width,
        height: result.height,
        durationMs: result.durationMs,
        metadata: {
          ...restMeta,
          ...result.metadata,
          // FR-MED-06b: oynatma kopyaları (v1080 / v720) — varsa.
          ...(keys.v1080 || keys.v720 ? { variants: pickVariants(keys) } : {}),
        },
        processingStatus: 'READY',
        processingError: null,
      },
    });
    if (count === 0) await removeKeys(Object.values(keys)); // işlem sırasında silindi
    await removeKeys([sourceKey]);
  } catch (err) {
    await markFailed(asset, err);
    if (sourceKey) await removeKeys([sourceKey]);
  } finally {
    const leftovers = [
      ...Object.values(result?.outputs ?? {}).map((o) => o.path),
      ...(result?.scratch ?? []),
    ];
    await Promise.all(leftovers.map((p) => rm(p, { force: true })));
  }
}

export function createMediaQueue({ pollMs = 30_000 } = {}) {
  let running = false;
  let again = false;
  let timer = null;
  let stopped = true;

  async function drain() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        let id;
        while (!stopped && (id = await claimNextVideo())) await processVideoAsset(id);
      } while (again && !stopped);
    } catch (err) {
      logger.error({ err }, 'Medya kuyruğu hatası');
    } finally {
      running = false;
    }
  }

  return {
    async start() {
      stopped = false;
      await recoverInterruptedJobs();
      timer = setInterval(drain, pollMs);
      timer.unref();
      void drain();
    },
    kick: () => void drain(),
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
    },
    isRunning: () => running,
  };
}
