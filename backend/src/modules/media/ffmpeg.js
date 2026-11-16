// SRS FR-MED-06, RULES.md §5.3 — FFmpeg/ffprobe çağrıları: argüman dizisi + spawn (shell yok).
// FFmpeg kurulu değilse açık hata (503 MEDIA_PROCESSOR_UNAVAILABLE) verilir; sessizce atlanmaz.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/httpError.js';

export const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000;
const PROBE_TIMEOUT_MS = 30_000;
const STDERR_TAIL = 4000;

export class FfmpegUnavailableError extends AppError {
  constructor() {
    super(
      503,
      'MEDIA_PROCESSOR_UNAVAILABLE',
      'Video işleme için sunucuda FFmpeg kurulu değil. FFmpeg kur veya FFMPEG_PATH ayarla.',
    );
  }
}

// Ek kurulum gerekmesin diye npm ile gelen ikililer (ffmpeg-static, @ffprobe-installer) varsayılan;
// FFMPEG_PATH / FFPROBE_PATH verilirse onlar önceliklidir (prod'da apt sürümü önerilir).
const require = createRequire(import.meta.url);
const bundled = (load) => {
  try {
    const file = load();
    return file && existsSync(file) ? file : null;
  } catch {
    return null;
  }
};
const BUNDLED_FFMPEG = bundled(() => require('ffmpeg-static'));
const BUNDLED_FFPROBE = bundled(() => require('@ffprobe-installer/ffprobe').path);

export function ffmpegPath() {
  return env.FFMPEG_PATH || BUNDLED_FFMPEG || 'ffmpeg';
}

/** FFPROBE_PATH yoksa: FFMPEG_PATH verilmişse yanındaki ffprobe, değilse npm ile gelen ffprobe. */
export function ffprobePath() {
  if (env.FFPROBE_PATH) return env.FFPROBE_PATH;
  if (!env.FFMPEG_PATH) return BUNDLED_FFPROBE || 'ffprobe';
  const dir = path.dirname(env.FFMPEG_PATH);
  return path.join(dir, path.basename(env.FFMPEG_PATH).replace(/ffmpeg/i, 'ffprobe'));
}

/**
 * @param {string} bin @param {string[]} args
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function run(bin, args, { timeoutMs = FFMPEG_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`İşlem zaman aşımına uğradı (${Math.round(timeoutMs / 1000)} sn).`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err.code === 'ENOENT' ? new FfmpegUnavailableError() : err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(bin)} çıkış kodu ${code}: ${stderr.slice(-400)}`));
    });
  });
}

let availability = null;

/** FFmpeg + ffprobe çalışıyor mu? Olumlu sonuç kalıcı, olumsuz sonuç 60 sn önbellekte. */
export async function isFfmpegAvailable() {
  if (availability && (availability.ok || availability.until > Date.now())) return availability.ok;
  let ok = true;
  try {
    await run(ffmpegPath(), ['-hide_banner', '-version'], { timeoutMs: 10_000 });
    await run(ffprobePath(), ['-hide_banner', '-version'], { timeoutMs: 10_000 });
  } catch {
    ok = false;
  }
  availability = { ok, until: Date.now() + 60_000 };
  return ok;
}

export async function assertFfmpegAvailable() {
  if (!(await isFfmpegAvailable())) throw new FfmpegUnavailableError();
}

/** Video akış bilgisi (süre, boyut, codec). */
export async function probeVideo(file) {
  const { stdout } = await run(
    ffprobePath(),
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { timeoutMs: PROBE_TIMEOUT_MS },
  );
  const info = JSON.parse(stdout);
  const video = info.streams?.find((s) => s.codec_type === 'video');
  if (!video) throw new Error('Dosyada video akışı yok.');
  return {
    durationSec: Number(info.format?.duration ?? video.duration ?? 0),
    width: video.width,
    height: video.height,
    codec: video.codec_name,
    hasAudio: Boolean(info.streams?.some((s) => s.codec_type === 'audio')),
  };
}

/**
 * H.264 + faststart, ses yok, metadata yok; genişlik maxWidth ile sınırlı (çift piksel).
 * crf: kalite (düşük = daha iyi). maxrate: bit hızı tavanı (ör. '5M'), çok detaylı görüntü sınırsız
 * büyümesin. fpsMax: kare hızı üst sınırı (kaynaktan yüksekse düşürülür, düşükse artırılmaz).
 */
export function transcodeVideo(
  input,
  output,
  { maxWidth, crf = 23, maxrate = null, fpsMax = null },
) {
  return run(ffmpegPath(), [
    '-hide_banner', '-nostdin', '-y', '-i', input,
    '-map', '0:v:0', '-map_metadata', '-1', '-an',
    '-vf', `scale='min(${maxWidth},iw)':-2`,
    ...(fpsMax ? ['-fpsmax', String(fpsMax)] : []),
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium', '-pix_fmt', 'yuv420p',
    ...(maxrate ? ['-maxrate', maxrate, '-bufsize', `${parseInt(maxrate, 10) * 2}M`] : []),
    '-movflags', '+faststart', output,
  ]); // prettier-ignore
}

/** Belirtilen saniyeden tek kare (PNG); Sharp ile WebP'ye çevrilir. */
export function extractFrame(input, output, atSec) {
  return run(ffmpegPath(), [
    '-hide_banner', '-nostdin', '-y', '-ss', String(atSec), '-i', input,
    '-frames:v', '1', output,
  ]); // prettier-ignore
}
