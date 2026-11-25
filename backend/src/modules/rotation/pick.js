// adım 4–7 — saf aday seçimi (yan etki yok, deterministik RNG ile test edilir).
import { randomInt } from 'node:crypto';

/**
 * @param {{ pool: number[], used: number[], previous?: number|null,
 *   exclude?: number|null, rng?: (n: number) => number }} input
 *   pool: uygun içerik id'leri · used: mevcut döngüde seçilmişler · previous: dünkü seçim
 *   exclude: yeniden seçimde değiştirilecek mevcut içerik (başka aday varsa elenir)
 * @returns {{ id: number, newCycle: boolean } | null}
 */
export function pickCandidate({ pool, used, previous = null, exclude = null, rng = randomInt }) {
  if (pool.length === 0) return null;
  const usedSet = new Set(used);
  const withoutExcluded = (ids) => {
    const filtered = ids.filter((id) => id !== exclude);
    return filtered.length > 0 ? filtered : ids;
  };

  let newCycle = false;
  let candidates = pool.filter((id) => !usedSet.has(id) && id !== exclude);
  if (candidates.length === 0) {
    // Döngü bitti: yeni döngü. Havuz > 1 ise dünkü içerik arka arkaya gelmesin.
    newCycle = true;
    candidates = withoutExcluded(pool.length > 1 ? pool.filter((id) => id !== previous) : pool);
  }
  return { id: candidates[rng(candidates.length)], newCycle };
}
