// ARCHITECTURE.md §8.1 — yerel disk sürücüsü. SEC-11: anahtar yalnızca sunucunun ürettiği
// storageKey'dir; çözümlenen yol depo kökü dışına çıkarsa işlem reddedilir.
import { createReadStream as fsReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat as fsStat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestError } from '../lib/httpError.js';

const KEY_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[A-Za-z0-9-]+\.[a-z0-9]{2,5}$/;

export class InvalidStorageKeyError extends BadRequestError {
  constructor() {
    super('Geçersiz depolama anahtarı.');
    this.code = 'INVALID_STORAGE_KEY';
  }
}

/** @param {string} root mutlak depo kökü */
export function createLocalStorage(root) {
  const base = path.resolve(root);

  /** Anahtarı mutlak yola çevirir; biçim veya kök dışı yol → 400 (SEC-11). */
  function resolveKey(key) {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new InvalidStorageKeyError();
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new InvalidStorageKeyError();
    return full;
  }

  /** Atomik yazım: önce `.partial`, sonra rename. Kaynak dosya taşınır (yoksa kopyalanır). */
  async function put(sourcePath, key) {
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    const partial = `${target}.${randomUUID()}.partial`;
    try {
      await rename(sourcePath, partial);
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      await copyFile(sourcePath, partial);
      await rm(sourcePath, { force: true });
    }
    try {
      await rename(partial, target);
    } catch (err) {
      await rm(partial, { force: true });
      throw err;
    }
    return { key };
  }

  async function stat(key) {
    const info = await fsStat(resolveKey(key));
    return { size: info.size, mtime: info.mtime };
  }

  /** @param {{ start?: number, end?: number }} [range] */
  const createReadStream = (key, range = {}) => fsReadStream(resolveKey(key), range);

  /** Dosya yoksa başarı sayılır (idempotent silme). */
  async function remove(key) {
    await rm(resolveKey(key), { force: true });
  }

  return { driver: 'local', root: base, resolveKey, put, stat, createReadStream, remove };
}
