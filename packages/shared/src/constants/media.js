// medya türü → uzantı / gerçek MIME / boyut / süre tablosu (tek kaynak).
// Backend doğrulama zinciri ve frontend UploadField (accept + istemci ön kontrolü) bunu kullanır.

const MB = 1024 * 1024;

/** Uzantı → `file-type` ile tespit edilen gerçek MIME'ler (adım 4). */
export const EXTENSION_MIME = Object.freeze({
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  mp4: ['video/mp4'],
  mp3: ['audio/mpeg'],
  ico: ['image/x-icon', 'image/vnd.microsoft.icon'],
  cur: ['image/x-icon', 'image/vnd.microsoft.icon'],
});

const IMAGE = ['jpg', 'jpeg', 'png'];

/**
 * Her tür birden fazla gruba sahip olabilir (ör. video + görsel ayrı limitler).
 * group: video | image | audio | icon. maxDimension: genişlik ve yükseklik üst sınırı (px).
 */
export const MEDIA_RULES = Object.freeze({
  BACKGROUND: [
    { group: 'video', extensions: ['mp4'], maxBytes: 200 * MB, maxDurationSec: 120 },
    { group: 'image', extensions: [...IMAGE, 'webp', 'gif'], maxBytes: 30 * MB },
  ],
  MUSIC_AUDIO: [{ group: 'audio', extensions: ['mp3'], maxBytes: 30 * MB, maxDurationSec: 900 }],
  MUSIC_COVER: [{ group: 'image', extensions: [...IMAGE, 'gif'], maxBytes: 10 * MB }],
  PROFILE: [
    { group: 'video', extensions: ['mp4'], maxBytes: 50 * MB, maxDurationSec: 30 },
    { group: 'image', extensions: [...IMAGE, 'gif'], maxBytes: 15 * MB },
  ],
  CURSOR: [
    { group: 'icon', extensions: ['png', 'cur', 'ico'], maxBytes: 512 * 1024, maxDimension: 128 },
  ],
  PROJECT_IMAGE: [{ group: 'image', extensions: [...IMAGE, 'webp', 'gif'], maxBytes: 15 * MB }],
  // SVG hiçbir türde kabul edilmez (XSS) — LINK_IMAGE için açıkça belirtildi.
  LINK_IMAGE: [{ group: 'image', extensions: [...IMAGE, 'webp', 'gif'], maxBytes: 5 * MB }],
  FAVICON: [{ group: 'icon', extensions: ['ico', 'png'], maxBytes: 1 * MB, maxDimension: 512 }],
  // Tech Stack daire görselleri ve amblem (şeffaf PNG önerilir; SVG yok).
  TECH_STACK_IMAGE: [{ group: 'image', extensions: [...IMAGE, 'webp', 'gif'], maxBytes: 5 * MB }],
  // 2026-11-16 — isim GIF katmanı (yalnızca GIF), yağan öğe görseli.
  NAME_OVERLAY: [{ group: 'image', extensions: ['gif'], maxBytes: 10 * MB }],
  FALLING_IMAGE: [
    { group: 'image', extensions: ['png', 'webp', 'gif'], maxBytes: 1 * MB }, // ≤ 256 px'e küçültülür
  ],
});

export const MEDIA_KINDS = Object.freeze(Object.keys(MEDIA_RULES));

/** Dosya adından küçük harfli uzantı ("" yoksa). */
export function extensionOf(filename) {
  const name = String(filename ?? '');
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Tür + uzantı için geçerli kural grubu; izin yoksa null. */
export function ruleFor(kind, extension) {
  return MEDIA_RULES[kind]?.find((r) => r.extensions.includes(extension)) ?? null;
}

/** Tür için izinli uzantılar (tekrarsız). */
export function allowedExtensions(kind) {
  return [...new Set((MEDIA_RULES[kind] ?? []).flatMap((r) => r.extensions))];
}

/** Yükleme akışının kesileceği üst sınır: türün en büyük grubu. */
export function maxUploadBytes(kind) {
  return Math.max(0, ...(MEDIA_RULES[kind] ?? []).map((r) => r.maxBytes));
}

/** `<input accept>` değeri. */
export function acceptAttribute(kind) {
  return allowedExtensions(kind)
    .map((ext) => `.${ext}`)
    .join(',');
}

/** Bayt → "1,5 MB" (tr-TR). */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** İstemci ön kontrolü (sunucu yine tam zinciri uygular). Hata mesajı ya da null döner. */
export function precheckFile(kind, { name, size }) {
  const extension = extensionOf(name);
  const rule = ruleFor(kind, extension);
  if (!rule) {
    return `Bu dosya türü desteklenmiyor. İzinli: ${allowedExtensions(kind).join(', ')}.`;
  }
  if (size > rule.maxBytes) {
    return `Dosya çok büyük (${formatBytes(size)}). Sınır: ${formatBytes(rule.maxBytes)}.`;
  }
  return null;
}
