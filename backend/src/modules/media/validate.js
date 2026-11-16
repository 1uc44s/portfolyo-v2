// SRS FR-MED-02 — doğrulama zinciri: (1) boyut (2) uzantı izin listesi (3) file-type magic bytes
// (4) uzantı–MIME eşleşmesi. Türe özel kontroller (boyut/süre) process.js'te.
import {
  EXTENSION_MIME,
  allowedExtensions,
  extensionOf,
  formatBytes,
  ruleFor,
} from '@vasquez/shared';
import { fileTypeFromFile } from 'file-type';
import { PayloadTooLargeError, UnsupportedMediaError } from '../../lib/httpError.js';

const canonicalExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

/**
 * @param {string} kind MediaKind
 * @param {{ path: string, originalname: string, size: number }} file multer dosyası
 * @returns {Promise<{ extension: string, mime: string, rule: object }>}
 */
export async function inspectUpload(kind, file) {
  const extension = extensionOf(file.originalname);
  const rule = ruleFor(kind, extension);
  if (!rule) {
    throw new UnsupportedMediaError(
      `Bu dosya türü desteklenmiyor. İzinli: ${allowedExtensions(kind).join(', ')}.`,
    );
  }
  if (file.size > rule.maxBytes) {
    throw new PayloadTooLargeError(
      `Dosya çok büyük (${formatBytes(file.size)}). Sınır: ${formatBytes(rule.maxBytes)}.`,
    );
  }
  if (file.size === 0) throw new UnsupportedMediaError('Dosya boş.');

  const detected = await fileTypeFromFile(file.path);
  const matches =
    detected &&
    EXTENSION_MIME[extension]?.includes(detected.mime) &&
    canonicalExt(detected.ext) === canonicalExt(extension);
  if (!matches) {
    throw new UnsupportedMediaError('Dosya içeriği uzantısıyla uyuşmuyor veya desteklenmiyor.');
  }
  return { extension: canonicalExt(extension), mime: detected.mime, rule };
}
