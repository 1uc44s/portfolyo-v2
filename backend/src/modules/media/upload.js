// SRS FR-MED-01, ROUTES.md §1.1 `upload(kind)` — multer diskStorage → uploads/tmp.
// Akış türün en büyük limitinde kesilir (413); yanıt bitince geçici dosya her durumda silinir.
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import multer from 'multer';
import { formatBytes, maxUploadBytes } from '@vasquez/shared';
import { AppError, PayloadTooLargeError, ValidationError } from '../../lib/httpError.js';
import { TMP_DIR, ensureStorageDirs } from '../../storage/index.js';

let dirsReady = null;
const ensureDirs = () => (dirsReady ??= ensureStorageDirs());

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirs().then(() => cb(null, TMP_DIR), cb);
  },
  // Kullanıcı dosya adı yol olarak kullanılmaz (RULES.md §5.3).
  filename: (_req, _file, cb) => cb(null, `${randomUUID()}.upload`),
});

function translate(err, kind, field) {
  if (!(err instanceof multer.MulterError)) return err;
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new PayloadTooLargeError(
      `Dosya çok büyük. Sınır: ${formatBytes(maxUploadBytes(kind))}.`,
    );
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError([
      { path: field, message: `Yalnızca tek dosya "${field}" alanında gönderilir.` },
    ]);
  }
  return new AppError(400, 'BAD_REQUEST', 'Yükleme isteği geçersiz.');
}

const removeAll = (files) => {
  for (const file of files) if (file?.path) rm(file.path, { force: true }).catch(() => {});
};

/**
 * Çok yuvalı yükleme (F7: müzik ses + kapak, cursor normal + tıklama). Akış, yuvaların en büyük
 * türe göre limitinde kesilir; her dosyanın kendi tür limiti `inspectUpload`'da (413) uygulanır.
 * Sonuç `req.slotFiles = { [field]: file }`. Eksik yuva: mode 'all' → her biri için 422,
 * mode 'any' → hiç dosya yoksa 422.
 * @param {{ field: string, kind: string }[]} slots
 * @param {{ mode?: 'all' | 'any' }} [options]
 */
export function uploadFields(slots, { mode = 'all' } = {}) {
  const maxBytes = Math.max(...slots.map((s) => maxUploadBytes(s.kind)));
  const handler = multer({
    storage: diskStorage,
    defParamCharset: 'utf8',
    limits: {
      fileSize: maxBytes,
      files: slots.length,
      fields: 20,
      fieldSize: 16 * 1024,
      parts: 20 + slots.length,
    },
  }).fields(slots.map((s) => ({ name: s.field, maxCount: 1 })));
  const fieldList = slots.map((s) => `"${s.field}"`).join(', ');

  return (req, res, next) => {
    res.on('close', () => removeAll(Object.values(req.files ?? {}).flat()));
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new PayloadTooLargeError(`Dosya çok büyük. Sınır: ${formatBytes(maxBytes)}.`));
      }
      if (err instanceof multer.MulterError) {
        const message = `Dosyalar yalnızca ${fieldList} alanlarında, her biri tek dosya olarak gönderilir.`;
        return next(new ValidationError([{ path: err.field ?? slots[0].field, message }]));
      }
      if (err) return next(new AppError(400, 'BAD_REQUEST', 'Yükleme isteği geçersiz.'));
      req.slotFiles = Object.fromEntries(
        slots.map((s) => [s.field, req.files?.[s.field]?.[0]]).filter(([, f]) => f),
      );
      const missing = slots.filter((s) => !req.slotFiles[s.field]);
      if (mode === 'all' && missing.length > 0) {
        const message =
          slots.length > 1 ? `Dosya seçilmedi. ${fieldList} birlikte zorunlu.` : 'Dosya seçilmedi.';
        return next(new ValidationError(missing.map((s) => ({ path: s.field, message }))));
      }
      if (missing.length === slots.length) {
        return next(new ValidationError([{ path: slots[0].field, message: 'Dosya seçilmedi.' }]));
      }
      return next();
    });
  };
}

/**
 * Aynı alanda çoklu dosya (F12 proje görselleri, ≤ max). Sonuç `req.files` dizisi; yoksa 422.
 * @param {string} kind MediaKind @param {string} field @param {number} max
 */
export function uploadMany(kind, field, max) {
  const handler = multer({
    storage: diskStorage,
    defParamCharset: 'utf8',
    limits: {
      fileSize: maxUploadBytes(kind),
      files: max,
      fields: 20,
      fieldSize: 16 * 1024,
      parts: 20 + max,
    },
  }).array(field, max);

  return (req, res, next) => {
    res.on('close', () => removeAll(req.files ?? []));
    handler(req, res, (err) => {
      if (
        err instanceof multer.MulterError &&
        (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT')
      ) {
        const message = `Tek istekte en fazla ${max} dosya "${field}" alanında gönderilir.`;
        return next(new ValidationError([{ path: field, message }]));
      }
      if (err) return next(translate(err, kind, field));
      if (!req.files?.length) {
        return next(new ValidationError([{ path: field, message: 'Dosya seçilmedi.' }]));
      }
      return next();
    });
  };
}

/**
 * Tek dosyalık yükleme middleware'i. Dosya yoksa 422 (`optional` ise devam eder).
 * @param {string} kind MediaKind @param {string} [field] @param {{ optional?: boolean }} [options]
 */
export function upload(kind, field = 'file', { optional = false } = {}) {
  const handler = multer({
    storage: diskStorage,
    defParamCharset: 'utf8', // tarayıcılar Türkçe dosya adını UTF-8 gönderir
    limits: {
      fileSize: maxUploadBytes(kind),
      files: 1,
      fields: 20,
      fieldSize: 16 * 1024,
      parts: 25,
    },
  }).single(field);

  return (req, res, next) => {
    res.on('close', () => {
      if (req.file?.path) rm(req.file.path, { force: true }).catch(() => {});
    });
    handler(req, res, (err) => {
      if (err) return next(translate(err, kind, field));
      if (!req.file && !optional)
        return next(new ValidationError([{ path: field, message: 'Dosya seçilmedi.' }]));
      return next();
    });
  };
}
