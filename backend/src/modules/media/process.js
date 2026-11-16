// SRS FR-MED-04..08 — türe özel işleme. Çıktılar TMP_DIR'e yazılır; kalıcı depoya taşıma service.js'te.
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';
import sharp from 'sharp';
import { ValidationError } from '../../lib/httpError.js';
import { TMP_DIR } from '../../storage/index.js';
import { probeVideo, assertFfmpegAvailable, extractFrame, transcodeVideo } from './ffmpeg.js';
import {
  MalformedMediaError,
  icoDimensions,
  stripGifMetadata,
  stripJpegMetadata,
  stripMp3Tags,
  stripPngMetadata,
} from './formats.js';

// Yağan öğe görselleri küçük kalır (ekranda 12–64 px).
const MAIN_MAX_EDGE = { FALLING_IMAGE: 256, default: 2560 };
const VIDEO_MAX_WIDTH = { default: 1920 };
const THUMB_EDGE = 480;

const fileError = (message) => new ValidationError([{ path: 'file', message }]);
const tmpFile = (ext) => path.join(TMP_DIR, `${randomUUID()}.${ext}`);
const fit = (edge) => ({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });

async function readImageMeta(input) {
  try {
    return await sharp(input).metadata();
  } catch {
    throw fileError('Görsel okunamadı; dosya bozuk olabilir.');
  }
}

async function writeThumb(input, options = {}) {
  const out = tmpFile('webp');
  await sharp(input, options).rotate().resize(fit(THUMB_EDGE)).webp({ quality: 70 }).toFile(out);
  return { path: out, ext: 'webp' };
}

/** Background (duvar kağıdı olarak indirilebilir) indirme varyantı: metadata'sız, mümkünse yeniden kodlanmamış orijinal (FR-MED-04). */
async function wallpaperDownload(input, mime, meta) {
  const raw = await readFile(input);
  let buffer;
  let ext;
  if (mime === 'image/png') {
    [buffer, ext] = [stripPngMetadata(raw), 'png'];
  } else if (mime === 'image/jpeg' && (meta.orientation ?? 1) === 1) {
    [buffer, ext] = [stripJpegMetadata(raw), 'jpg'];
  } else if (mime === 'image/jpeg') {
    // EXIF yönü kaybolmasın: döndürülüp yüksek kalitede yeniden kodlanır (metadata yok).
    buffer = await sharp(raw).rotate().jpeg({ quality: 95, mozjpeg: true }).toBuffer();
    ext = 'jpg';
  } else {
    buffer = await sharp(raw).rotate().webp({ quality: 95 }).toBuffer();
    ext = 'webp';
  }
  const out = tmpFile(ext);
  await writeFile(out, buffer);
  return { path: out, ext };
}

async function processAnimatedGif(input, meta) {
  const { buffer } = stripGifMetadata(await readFile(input));
  const main = tmpFile('gif');
  await writeFile(main, buffer);
  return {
    mediaType: 'ANIMATED_IMAGE',
    mimeType: 'image/gif',
    extension: 'gif',
    width: meta.width,
    height: meta.pageHeight ?? meta.height,
    metadata: { frames: meta.pages, loop: meta.loop ?? null },
    outputs: { main: { path: main, ext: 'gif' }, thumb: await writeThumb(input, { pages: 1 }) },
  };
}

async function processImage({ kind, inputPath, mime }) {
  const meta = await readImageMeta(inputPath);
  if (mime === 'image/gif' && (meta.pages ?? 1) > 1) return processAnimatedGif(inputPath, meta);

  const main = tmpFile('webp');
  const edge = MAIN_MAX_EDGE[kind] ?? MAIN_MAX_EDGE.default;
  // Sharp varsayılan olarak metadata (EXIF/GPS/XMP/ICC dışı) yazmaz; rotate() EXIF yönünü uygular.
  const info = await sharp(inputPath).rotate().resize(fit(edge)).webp({ quality: 82 }).toFile(main);
  const outputs = { main: { path: main, ext: 'webp' }, thumb: await writeThumb(inputPath) };
  if (kind === 'BACKGROUND') outputs.download = await wallpaperDownload(inputPath, mime, meta);
  return {
    mediaType: 'IMAGE',
    mimeType: 'image/webp',
    extension: 'webp',
    width: info.width,
    height: info.height,
    metadata: { sourceMime: mime },
    outputs,
  };
}

/** Cursor / favicon: boyut kontrolü, yeniden kodlama yok (PNG'de metin/EXIF chunk'ları atılır). */
async function processIcon({ kind, inputPath, mime, extension, rule }) {
  const raw = await readFile(inputPath);
  const isPng = mime === 'image/png';
  const { width, height } = isPng ? await readImageMeta(inputPath) : icoDimensions(raw);
  if (width > rule.maxDimension || height > rule.maxDimension) {
    throw fileError(
      `Görsel en fazla ${rule.maxDimension}×${rule.maxDimension} px olmalı (yüklenen ${width}×${height}).`,
    );
  }
  const main = tmpFile(extension);
  await writeFile(main, isPng ? stripPngMetadata(raw) : raw);
  return {
    mediaType: kind === 'CURSOR' ? 'CURSOR' : 'IMAGE',
    mimeType: mime,
    extension,
    width,
    height,
    metadata: null,
    outputs: { main: { path: main, ext: extension } },
  };
}

/** MP3: süre music-metadata ile; ID3/APE etiketleri (gömülü kapak dahil) JS ile atılır. */
async function processAudio({ inputPath, rule }) {
  let info;
  try {
    info = await parseFile(inputPath, { duration: true, skipCovers: true });
  } catch {
    throw fileError('Ses dosyası okunamadı.');
  }
  const durationSec = info.format.duration ?? 0;
  if (!durationSec) throw fileError('Ses dosyasının süresi okunamadı.');
  if (durationSec > rule.maxDurationSec) {
    throw fileError(`Ses en fazla ${Math.round(rule.maxDurationSec / 60)} dakika olabilir.`);
  }
  const main = tmpFile('mp3');
  await writeFile(main, stripMp3Tags(await readFile(inputPath)));
  return {
    mediaType: 'AUDIO',
    mimeType: 'audio/mpeg',
    extension: 'mp3',
    width: null,
    height: null,
    durationMs: Math.round(durationSec * 1000),
    metadata: {
      bitrate: info.format.bitrate ?? null,
      sampleRate: info.format.sampleRate ?? null,
      channels: info.format.numberOfChannels ?? null,
    },
    outputs: { main: { path: main, ext: 'mp3' } },
  };
}

/** Yükleme anında video ön kontrolü: FFmpeg var mı, akış okunuyor mu, süre limiti. */
export async function inspectVideo({ inputPath, rule }) {
  await assertFfmpegAvailable();
  let probe;
  try {
    probe = await probeVideo(inputPath);
  } catch {
    throw fileError('Video okunamadı; dosya bozuk olabilir.');
  }
  if (rule.maxDurationSec && probe.durationSec > rule.maxDurationSec) {
    throw fileError(`Video en fazla ${rule.maxDurationSec} saniye olabilir.`);
  }
  return probe;
}

/**
 * FR-MED-06b (2026-11-16) — arka plan videoları: ana kopya 4K'ya kadar yüksek kalite (indirme ve büyük
 * ekranlar), ayrıca 1080p ve 720p oynatma kopyaları (kaynaktan küçükse). Hepsi H.264 (her tarayıcı),
 * ≤ 30 fps, bit hızı tavanlı. Site ekrana uygun olanı seçer.
 */
export const BACKGROUND_VIDEO = Object.freeze({
  main: { maxWidth: 3840, crf: 20, maxrate: '16M', fpsMax: 30 },
  variants: {
    v1080: { maxWidth: 1920, crf: 23, maxrate: '5M', fpsMax: 30 },
    v720: { maxWidth: 1280, crf: 24, maxrate: '3M', fpsMax: 30 },
  },
});

/** Kuyruk işi (FR-MED-06): H.264 + faststart, poster (1. sn) ve thumbnail WebP. */
export async function processVideo({ kind, sourcePath, durationSec }) {
  await assertFfmpegAvailable();
  const main = tmpFile('mp4');
  const frame = tmpFile('png');
  const poster = tmpFile('webp');
  const background = kind === 'BACKGROUND';
  const maxWidth = VIDEO_MAX_WIDTH[kind] ?? VIDEO_MAX_WIDTH.default;
  await transcodeVideo(sourcePath, main, background ? BACKGROUND_VIDEO.main : { maxWidth });
  const extra = {};
  if (background) {
    const source = await probeVideo(sourcePath);
    for (const [role, opts] of Object.entries(BACKGROUND_VIDEO.variants)) {
      if (source.width <= opts.maxWidth) continue; // kaynaktan büyük kopya üretilmez
      const out = tmpFile('mp4');
      await transcodeVideo(sourcePath, out, opts);
      extra[role] = { path: out, ext: 'mp4' };
    }
  }
  await extractFrame(main, frame, durationSec > 1 ? 1 : 0);
  const info = await sharp(frame).webp({ quality: 82 }).toFile(poster);
  const thumb = await writeThumb(frame);
  const probe = await probeVideo(main);
  return {
    width: probe.width,
    height: probe.height,
    durationMs: Math.round(probe.durationSec * 1000),
    metadata: { codec: probe.codec, posterWidth: info.width },
    outputs: {
      main: { path: main, ext: 'mp4' },
      poster: { path: poster, ext: 'webp' },
      thumb,
      ...extra,
    },
    scratch: [frame],
  };
}

/** Senkron işlenen gruplar (video hariç). */
export async function processUpload(input) {
  try {
    if (input.rule.group === 'image') return await processImage(input);
    if (input.rule.group === 'icon') return await processIcon(input);
    if (input.rule.group === 'audio') return await processAudio(input);
  } catch (err) {
    if (err instanceof MalformedMediaError) throw fileError(err.message);
    throw err;
  }
  throw new Error(`Senkron işlenemeyen grup: ${input.rule.group}`);
}
