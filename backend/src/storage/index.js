// ARCHITECTURE.md §8.1 — sürücü seçimi ve depo dizin düzeni.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { createLocalStorage } from './local.js';
import { createS3Storage } from './s3.js';

const BACKEND_DIR = fileURLToPath(new URL('../..', import.meta.url));

/** Göreli STORAGE_ROOT backend dizinine göre çözülür (çalışma dizininden bağımsız). */
export const STORAGE_ROOT = path.resolve(BACKEND_DIR, env.STORAGE_ROOT);

/** Yüklemelerin ilk indiği geçici dizin (FR-MED-01) ve video kuyruğu kaynakları. */
export const TMP_DIR = path.join(STORAGE_ROOT, 'tmp');
export const QUEUE_DIR = path.join(TMP_DIR, 'queue');

/** MediaKind → kalıcı dizin. Türevler thumbnails/ ve posters/ altında. */
export const KIND_DIRS = Object.freeze({
  BACKGROUND: 'bg',
  MUSIC_AUDIO: 'musics',
  MUSIC_COVER: 'musics',
  PROFILE: 'pfps',
  CURSOR: 'cursors',
  PROJECT_IMAGE: 'projects',
  LINK_IMAGE: 'links',
  FAVICON: 'favicons',
  TECH_STACK_IMAGE: 'techstack',
  NAME_OVERLAY: 'name-overlays',
  FALLING_IMAGE: 'falling',
});

export const storage =
  env.STORAGE_DRIVER === 's3' ? createS3Storage() : createLocalStorage(STORAGE_ROOT);

export async function ensureStorageDirs() {
  await mkdir(QUEUE_DIR, { recursive: true });
}
