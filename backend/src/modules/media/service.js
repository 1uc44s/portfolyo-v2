// yükleme alımı: doğrula → işle → kalıcı depoya taşı → MediaAsset.
// Video: doğrulanır, kaynak kuyruk dizinine taşınır, kayıt PENDING oluşturulur (mediaQueue işler).
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { AppError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { KIND_DIRS, storage } from '../../storage/index.js';
import { writeAudit } from '../audit/service.js';
import { inspectVideo, processUpload } from './process.js';
import { inspectUpload } from './validate.js';

/** Medya kuyruğu ve silme worker'ı kendini buraya bağlar (döngüsel import yok). */
export const hooks = { onVideoQueued: () => {}, onDeletionQueued: () => {} };

const TR_MAP = {
  ı: 'i',
  İ: 'i',
  ş: 's',
  Ş: 's',
  ğ: 'g',
  Ğ: 'g',
  ç: 'c',
  Ç: 'c',
  ö: 'o',
  Ö: 'o',
  ü: 'u',
  Ü: 'u',
};

/** indirme adı: Türkçe harfler sadeleşir, yalnızca [a-z0-9-], ≤ 80 karakter. */
export function safeFilenameOf(originalName) {
  const stem = String(originalName ?? '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]*$/, '');
  const slug = stem
    .replace(/[ıİşŞğĞçÇöÖüÜ]/g, (c) => TR_MAP[c])
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug || 'dosya';
}

export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/** Varyant anahtarları: `<dizin>/<assetId>.<ext>`, türevler thumbnails/ ve posters/. */
export function variantKey(kind, assetId, role, ext) {
  if (role === 'thumb') return `thumbnails/${assetId}.${ext}`;
  if (role === 'poster') return `posters/${assetId}.${ext}`;
  if (role === 'download') return `${KIND_DIRS[kind]}/${assetId}-original.${ext}`;
  if (role === 'v1080' || role === 'v720')
    return `${KIND_DIRS[kind]}/${assetId}-${role.slice(1)}.${ext}`;
  return `${KIND_DIRS[kind]}/${assetId}.${ext}`;
}

export const queueKey = (assetId) => `tmp/queue/${assetId}.mp4`;

/** Çıktıları kalıcı depoya taşır; { main, thumb, poster, download } anahtarları + toplam boyut. */
export async function persistOutputs(kind, assetId, outputs) {
  const keys = {};
  let totalBytes = 0;
  try {
    for (const [role, output] of Object.entries(outputs)) {
      const key = variantKey(kind, assetId, role, output.ext);
      await storage.put(output.path, key);
      keys[role] = key;
      totalBytes += (await storage.stat(key)).size;
    }
  } catch (err) {
    await removeKeys(Object.values(keys));
    throw err;
  }
  return { keys, totalBytes };
}

export async function removeKeys(keys) {
  for (const key of keys) {
    try {
      await storage.remove(key);
    } catch (err) {
      logger.warn({ err, key }, 'Depo dosyası silinemedi');
    }
  }
}

/** aynı türde aynı hash varsa uyarı bilgisi (engellemez). */
async function findDuplicate(kind, sha256) {
  const existing = await prisma.mediaAsset.findFirst({
    where: { kind, sha256 },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalFilename: true },
  });
  return existing && { id: existing.id, title: existing.originalFilename };
}

function baseRecord({ id, kind, file, sha256, adminId, detected }) {
  return {
    id,
    kind,
    originalFilename: String(file.originalname).normalize('NFC').slice(0, 255),
    safeFilename: safeFilenameOf(file.originalname),
    sizeBytes: file.size,
    sha256,
    uploadedById: adminId ?? null,
    extension: detected.extension,
  };
}

async function ingestVideo({ base, file, detected }) {
  const probe = await inspectVideo({ inputPath: file.path, rule: detected.rule });
  const sourceKey = queueKey(base.id);
  await storage.put(file.path, sourceKey);
  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        ...base,
        mediaType: 'VIDEO',
        mimeType: 'video/mp4',
        extension: 'mp4',
        storageKey: variantKey(base.kind, base.id, 'main', 'mp4'),
        width: probe.width,
        height: probe.height,
        durationMs: Math.round(probe.durationSec * 1000),
        processingStatus: 'PENDING',
        metadata: { sourceKey, sourceCodec: probe.codec, sourceHasAudio: probe.hasAudio },
      },
    });
    hooks.onVideoQueued();
    return asset;
  } catch (err) {
    await removeKeys([sourceKey]);
    throw err;
  }
}

async function ingestSync({ base, file, detected }) {
  const result = await processUpload({
    kind: base.kind,
    inputPath: file.path,
    mime: detected.mime,
    extension: detected.extension,
    rule: detected.rule,
  });
  try {
    const { keys, totalBytes } = await persistOutputs(base.kind, base.id, result.outputs);
    try {
      return await prisma.mediaAsset.create({
        data: {
          ...base,
          mediaType: result.mediaType,
          mimeType: result.mimeType,
          extension: result.extension,
          storageKey: keys.main,
          thumbnailKey: keys.thumb ?? null,
          posterKey: keys.poster ?? null,
          downloadKey: keys.download ?? null,
          totalBytes,
          width: result.width ?? null,
          height: result.height ?? null,
          durationMs: result.durationMs ?? null,
          metadata: result.metadata ?? undefined,
          processingStatus: 'READY',
        },
      });
    } catch (err) {
      await removeKeys(Object.values(keys));
      throw err;
    }
  } finally {
    await Promise.all(Object.values(result.outputs).map((o) => rm(o.path, { force: true })));
  }
}

/**
 * Tek dosyalık yükleme alımı. Geçici dosya çağıranın sorumluluğundadır (upload middleware siler).
 * @param {{ kind: string, file: { path: string, originalname: string, size: number },
 *   adminId?: string, ctx?: object }} input
 * @returns {Promise<{ asset: object, duplicateOf: { id: string, title: string } | null }>}
 */
export async function ingestUpload({ kind, file, adminId, ctx }) {
  const detected = await inspectUpload(kind, file);
  const sha256 = await sha256File(file.path);
  const duplicateOf = await findDuplicate(kind, sha256);
  const base = baseRecord({ id: randomUUID(), kind, file, sha256, adminId, detected });
  const asset =
    detected.rule.group === 'video'
      ? await ingestVideo({ base, file, detected })
      : await ingestSync({ base, file, detected });
  await writeAudit({
    adminId,
    action: 'MEDIA_UPLOADED',
    entityType: 'MediaAsset',
    entityId: asset.id,
    metadata: {
      kind,
      mediaType: asset.mediaType,
      sizeBytes: asset.sizeBytes,
      duplicate: !!duplicateOf,
    },
    ctx,
  });
  return { asset, duplicateOf };
}

/** Asset'in tüm depo anahtarları (silme kuyruğu için). */
export function assetKeys(asset) {
  return [
    asset.storageKey,
    asset.thumbnailKey,
    asset.posterKey,
    asset.downloadKey,
    asset.metadata?.sourceKey,
    ...Object.values(asset.metadata?.variants ?? {}),
  ].filter(Boolean);
}

/** hiçbir sahibe bağlı olmayan asset koşulu. */
export const ORPHAN_WHERE = Object.freeze({
  background: null,
  musicAudio: null,
  musicCover: null,
  profileMedia: null,
  cursorNormal: null,
  cursorClick: null,
  projectImage: null,
  linkItem: null,
  faviconOf: { none: {} },
  techStackItem: null,
  nameOverlay: null,
  fallingItem: null,
});

/**
 * transaction içinde asset'leri "hâlâ yetimse" koşuluyla siler (yarışa dayanıklı) ve
 * dosyalarını StorageDeletionJob'a yazar. Kullanımdaki asset: skipInUse ise atlanır, değilse 409.
 * Commit sonrası `hooks.onDeletionQueued()` çağrılmalı (çağıran yapar).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<string[]>} silinen asset id'leri
 */
export async function deleteAssetsInTx(tx, assets, { skipInUse = false } = {}) {
  const deleted = [];
  for (const asset of assets) {
    const { count } = await tx.mediaAsset.deleteMany({ where: { id: asset.id, ...ORPHAN_WHERE } });
    if (count === 0 && skipInUse) continue;
    if (count === 0)
      throw new AppError(409, 'IN_USE', 'Bu medya kullanımda; önce kullanan kaydı sil.');
    deleted.push(asset);
  }
  if (deleted.length > 0) {
    await tx.storageDeletionJob.createMany({
      data: deleted.flatMap(assetKeys).map((storageKey) => ({ storageKey })),
    });
  }
  return deleted.map((a) => a.id);
}

export const mediaUrl = (asset, variant = 'main') => `/media/${asset.id}/${variant}`;

/** Admin yanıt şekli (iç anahtarlar dönmez). */
export function toAssetDto(asset) {
  return {
    id: asset.id,
    kind: asset.kind,
    mediaType: asset.mediaType,
    processingStatus: asset.processingStatus,
    processingError: asset.processingError,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    totalBytes: asset.totalBytes,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    previewUrl: `/api/admin/media/assets/${asset.id}/file/main`,
    thumbUrl: asset.thumbnailKey ? `/api/admin/media/assets/${asset.id}/file/thumb` : null,
    posterUrl: asset.posterKey ? `/api/admin/media/assets/${asset.id}/file/poster` : null,
    createdAt: asset.createdAt,
  };
}
