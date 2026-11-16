// FR-DL-04..09, FR-DSH-04 — public indirme listeleri (keyset, id ASC) ve indirme ucu.
// Görünürlük: TARGETS[].where (pfp: aktif + indirilebilir; wallpaper: aktif + isWallpaper; asset READY); aksi halde 404 (ifşa yok).
import { createHmac } from 'node:crypto';
import { NotFoundError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { istanbulDate, istanbulMidnight } from '../../lib/time.js';
import { getDailySalt } from '../../jobs/dailySalt.js';
import { storage } from '../../storage/index.js';
import { mediaUrl } from '../media/service.js';
import { DOWNLOADABLE_WHERE, WALLPAPER_WHERE } from './visibility.js';

export const PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

/** URL hedefi → model, DownloadEvent hedefi ve FK alanı. */
export const TARGETS = Object.freeze({
  // Duvar kağıtları = isWallpaper işaretli background'lar.
  wallpaper: {
    delegate: 'background',
    target: 'WALLPAPER',
    fk: 'backgroundId',
    where: WALLPAPER_WHERE,
  },
  pfp: { delegate: 'profileMedia', target: 'PFP', fk: 'profileMediaId', where: DOWNLOADABLE_WHERE },
});

const ASSET_SELECT = {
  id: true,
  mediaType: true,
  storageKey: true,
  posterKey: true,
  thumbnailKey: true,
  downloadKey: true,
  mimeType: true,
  extension: true,
  safeFilename: true,
  width: true,
  height: true,
};

const MIME_BY_EXT = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
});

/** ROUTES.md §3 MediaCard. */
export function toMediaCard(urlTarget, record) {
  const { asset } = record;
  return {
    publicId: record.publicId,
    title: record.title,
    type: asset.mediaType,
    previewUrl: mediaUrl(asset),
    thumbUrl: asset.thumbnailKey ? mediaUrl(asset, 'thumb') : mediaUrl(asset),
    posterUrl: asset.posterKey ? mediaUrl(asset, 'poster') : null,
    width: asset.width,
    height: asset.height,
    downloadUrl: `/api/public/downloads/${urlTarget}/${record.publicId}`,
  };
}

/** Keyset sayfalama: `cursor` = son görülen id (yanıtta opak tamsayı). */
export async function listDownloadable(urlTarget, { cursor, limit = PAGE_SIZE }) {
  const { delegate, where } = TARGETS[urlTarget];
  const rows = await prisma[delegate].findMany({
    where: { ...where, ...(cursor && { id: { gt: cursor } }) },
    orderBy: { id: 'asc' },
    take: limit + 1,
    select: { id: true, publicId: true, title: true, asset: { select: ASSET_SELECT } },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => toMediaCard(urlTarget, row)),
    nextCursor: rows.length > limit ? page.at(-1).id : null,
  };
}

/** FR-DSH-02 — günlük tuzla HMAC; ham IP saklanmaz. */
export async function visitorHashOf(req) {
  const salt = await getDailySalt();
  const ua = req.get('user-agent') ?? '';
  return createHmac('sha256', salt).update(`${req.ip}|${ua}`, 'utf8').digest('hex');
}

/**
 * İndirme olayını yazar; aynı ziyaretçi + içerik için Istanbul günü içinde yalnızca ilki sayılır.
 * Danışma kilidi eşzamanlı isteklerin ikisinin birden sayılmasını engeller.
 */
export async function recordDownload(urlTarget, itemId, visitorHash, now = Date.now()) {
  const { delegate, target, fk } = TARGETS[urlTarget];
  const since = istanbulMidnight(istanbulDate(now));
  return prisma.$transaction(async (tx) => {
    const lockKey = `download:${target}:${itemId}:${visitorHash}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const seen = await tx.downloadEvent.findFirst({
      where: { [fk]: itemId, visitorHash, counted: true, createdAt: { gte: since } },
      select: { id: true },
    });
    const counted = !seen;
    await tx.downloadEvent.create({ data: { target, [fk]: itemId, visitorHash, counted } });
    if (counted) {
      await tx[delegate].update({
        where: { id: itemId },
        data: { downloadCount: { increment: 1 } },
      });
    }
    return counted;
  });
}

/** İndirilecek dosya: background görselinde temizlenmiş `download` varyantı, yoksa ana dosya. */
export function downloadFileOf(asset) {
  if (asset.downloadKey) {
    const ext = asset.downloadKey.split('.').pop().toLowerCase();
    return { key: asset.downloadKey, ext, type: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  }
  const ext = asset.extension.toLowerCase();
  return { key: asset.storageKey, ext, type: asset.mimeType };
}

/** RFC 6266/5987: ASCII yedek ad + UTF-8 `filename*`. safeFilename zaten [a-z0-9-]. */
export const contentDisposition = (name) =>
  `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export async function sendDownload(req, res, urlTarget, publicId) {
  const def = TARGETS[urlTarget];
  if (!def) throw new NotFoundError();
  const item = await prisma[def.delegate].findFirst({
    where: { ...def.where, publicId },
    select: { id: true, asset: { select: ASSET_SELECT } },
  });
  if (!item) throw new NotFoundError();

  const file = downloadFileOf(item.asset);
  storage.resolveKey(file.key); // SEC-11
  let info;
  try {
    info = await storage.stat(file.key);
  } catch (err) {
    if (err.code === 'ENOENT') throw new NotFoundError();
    throw err;
  }

  await recordDownload(urlTarget, item.id, await visitorHashOf(req));

  res.set({
    'Content-Type': file.type,
    'Content-Length': String(info.size),
    'Content-Disposition': contentDisposition(`${item.asset.safeFilename}.${file.ext}`),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (info.size === 0) return res.end();
  const stream = storage.createReadStream(file.key);
  stream.on('error', (err) => {
    req.log?.warn({ err }, 'İndirme akışı kesildi');
    res.destroy(err);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
