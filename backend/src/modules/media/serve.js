// `/media/:assetId/:variant`.
// Range (tek aralık), ETag/304, immutable cache (public), nosniff. Varlık ifşa edilmez: 404.
import { Router } from 'express';
import { NotFoundError } from '../../lib/httpError.js';
import { storage } from '../../storage/index.js';
import { findAssetWithOwners, isPubliclyVisible } from './library.js';

export const VARIANTS = Object.freeze(['main', 'thumb', 'poster', 'v1080', 'v720']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidAssetParams = ({ assetId, variant }) =>
  UUID.test(assetId ?? '') && VARIANTS.includes(variant);

function variantOf(asset, variant) {
  if (variant === 'thumb')
    return asset.thumbnailKey && { key: asset.thumbnailKey, type: 'image/webp' };
  if (variant === 'poster') return asset.posterKey && { key: asset.posterKey, type: 'image/webp' };
  if (variant === 'v1080' || variant === 'v720') {
    const key = asset.metadata?.variants?.[variant];
    return key ? { key, type: 'video/mp4' } : null;
  }
  return { key: asset.storageKey, type: asset.mimeType };
}

/**
 * Asset varyantını akış olarak gönderir.
 * @param {{ cacheControl: string }} options
 */
export async function sendAssetVariant(req, res, asset, variant, { cacheControl }) {
  const target = variantOf(asset, variant);
  if (!target) throw new NotFoundError();
  storage.resolveKey(target.key); // bozuk/kök dışı anahtar → 400, dosya okunmaz

  let info;
  try {
    info = await storage.stat(target.key);
  } catch (err) {
    if (err.code === 'ENOENT') throw new NotFoundError();
    throw err;
  }

  const etag = `"${asset.id.slice(0, 8)}-${variant}-${info.size.toString(36)}-${info.mtime.getTime().toString(36)}"`;
  res.set({
    'Content-Type': target.type,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': 'inline',
    ETag: etag,
    'Last-Modified': info.mtime.toUTCString(),
  });
  if (req.fresh) return res.status(304).end();

  let start = 0;
  let end = info.size - 1;
  const ranges = req.headers.range ? req.range(info.size, { combine: true }) : undefined;
  if (ranges === -1) {
    res.set('Content-Range', `bytes */${info.size}`);
    return res.status(416).end();
  }
  if (Array.isArray(ranges) && ranges.type === 'bytes' && ranges.length === 1) {
    ({ start, end } = ranges[0]);
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${info.size}`);
  }
  res.set('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD' || info.size === 0) return res.end();

  const stream = storage.createReadStream(target.key, { start, end });
  stream.on('error', (err) => {
    req.log?.warn({ err }, 'Medya akışı kesildi');
    res.destroy(err);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

/** Public medya (L0): yalnızca READY + public-görünür sahipli asset'ler. */
export function mediaServeRoutes() {
  const router = Router();
  router.get('/:assetId/:variant', async (req, res) => {
    if (!isValidAssetParams(req.params)) throw new NotFoundError();
    const asset = await findAssetWithOwners(req.params.assetId);
    if (!asset || !isPubliclyVisible(asset)) throw new NotFoundError();
    await sendAssetVariant(req, res, asset, req.params.variant, {
      cacheControl: 'public, max-age=31536000, immutable',
    });
  });
  return router;
}
