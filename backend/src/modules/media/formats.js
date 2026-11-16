// SRS FR-MED-04/05/07/08 — yeniden kodlamadan metadata temizliği ve boyut okuma (saf fonksiyonlar).
// Her fonksiyon Buffer alır/döndürür; biçim bozuksa MalformedMediaError fırlatır.

export class MalformedMediaError extends Error {
  constructor(message = 'Dosya biçimi bozuk.') {
    super(message);
    this.name = 'MalformedMediaError';
  }
}

const need = (condition) => {
  if (!condition) throw new MalformedMediaError();
};

// ───────────── PNG: yalnızca görüntü için gerekli chunk'lar kalır (tEXt/iTXt/zTXt/eXIf/tIME düşer).
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs',
  'acTL', 'fcTL', 'fdAT',
]); // prettier-ignore

export function stripPngMetadata(buffer) {
  need(buffer.subarray(0, 8).equals(PNG_SIGNATURE));
  const parts = [PNG_SIGNATURE];
  let offset = 8;
  let ended = false;
  while (offset + 12 <= buffer.length && !ended) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const end = offset + 12 + length;
    need(end <= buffer.length);
    if (PNG_KEEP.has(type)) parts.push(buffer.subarray(offset, end));
    ended = type === 'IEND';
    offset = end;
  }
  need(ended);
  return Buffer.concat(parts);
}

// ───────────── JPEG: APP1..APP15 (EXIF/XMP/IPTC) ve COM düşer; APP0 (JFIF), APP2 ICC ve APP14 (Adobe) kalır.
const isIccSegment = (segment) => segment.toString('latin1', 4, 15) === 'ICC_PROFILE';

export function stripJpegMetadata(buffer) {
  need(buffer[0] === 0xff && buffer[1] === 0xd8);
  const parts = [buffer.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    need(buffer[offset] === 0xff);
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1; // dolgu baytı
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    need(length >= 2 && end <= buffer.length);
    if (marker === 0xda) {
      parts.push(buffer.subarray(offset)); // SOS: sıkıştırılmış veri olduğu gibi
      return Buffer.concat(parts);
    }
    const segment = buffer.subarray(offset, end);
    const isApp = marker >= 0xe1 && marker <= 0xef;
    const keepApp = marker === 0xee || (marker === 0xe2 && isIccSegment(segment));
    if (!(isApp && !keepApp) && marker !== 0xfe) parts.push(segment);
    offset = end;
  }
  throw new MalformedMediaError();
}

// ───────────── GIF: yorum/düz metin ve döngü dışı uygulama uzantıları düşer; kareler aynen kalır.
const GIF_KEEP_APPS = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0']);

function skipSubBlocks(buffer, offset) {
  let cursor = offset;
  for (;;) {
    need(cursor < buffer.length);
    const size = buffer[cursor];
    cursor += 1 + size;
    if (size === 0) return cursor;
  }
}

const colorTableSize = (packed) => (packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0);

export function stripGifMetadata(buffer) {
  const header = buffer.toString('latin1', 0, 6);
  need(header === 'GIF87a' || header === 'GIF89a');
  need(buffer.length >= 13);
  let offset = 13 + colorTableSize(buffer[10]);
  need(offset <= buffer.length);
  const parts = [buffer.subarray(0, offset)];
  let frames = 0;
  for (;;) {
    need(offset < buffer.length);
    const introducer = buffer[offset];
    if (introducer === 0x3b) {
      parts.push(buffer.subarray(offset, offset + 1));
      return { buffer: Buffer.concat(parts), frames };
    }
    if (introducer === 0x2c) {
      need(offset + 10 <= buffer.length);
      const dataStart = offset + 10 + colorTableSize(buffer[offset + 9]) + 1; // + LZW min code
      const end = skipSubBlocks(buffer, dataStart);
      parts.push(buffer.subarray(offset, end));
      frames += 1;
      offset = end;
      continue;
    }
    need(introducer === 0x21 && offset + 2 < buffer.length);
    const label = buffer[offset + 1];
    const end = skipSubBlocks(buffer, offset + 2);
    const appId = buffer.toString('latin1', offset + 3, offset + 14);
    const keep = label === 0xf9 || (label === 0xff && GIF_KEEP_APPS.has(appId));
    if (keep) parts.push(buffer.subarray(offset, end));
    offset = end;
  }
}

// ───────────── MP3: ID3v2 (baştaki, tekrarlı), ID3v1 ve APEv2 etiketleri (gömülü kapak dahil) düşer.
const syncSafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];

export function stripMp3Tags(buffer) {
  let start = 0;
  while (buffer.toString('latin1', start, start + 3) === 'ID3') {
    need(start + 10 <= buffer.length);
    const footer = buffer[start + 5] & 0x10 ? 10 : 0;
    start += 10 + syncSafe(buffer, start + 6) + footer;
    need(start <= buffer.length);
  }
  let end = buffer.length;
  for (let changed = true; changed;) {
    changed = false;
    if (end - start >= 128 && buffer.toString('latin1', end - 128, end - 125) === 'TAG') {
      end -= 128;
      changed = true;
    }
    if (end - start >= 32 && buffer.toString('latin1', end - 32, end - 24) === 'APETAGEX') {
      const size = buffer.readUInt32LE(end - 20);
      const hasHeader = (buffer.readUInt32LE(end - 12) & 0x80000000) !== 0;
      end -= size + (hasHeader ? 32 : 0);
      need(end >= start);
      changed = true;
    }
  }
  return buffer.subarray(start, end);
}

// ───────────── ICO/CUR: dizindeki en büyük girişin boyutu (0 = 256 px).
export function icoDimensions(buffer) {
  need(buffer.length >= 6 && buffer.readUInt16LE(0) === 0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  need((type === 1 || type === 2) && count > 0 && buffer.length >= 6 + count * 16);
  let width = 0;
  let height = 0;
  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    width = Math.max(width, buffer[entry] || 256);
    height = Math.max(height, buffer[entry + 1] || 256);
  }
  return { width, height, entries: count };
}
