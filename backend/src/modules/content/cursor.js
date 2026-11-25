// cursor hotspot'u görsel sınırları içinde olmalı (0 ≤ x < genişlik, 0 ≤ y < yükseklik).
import { HOTSPOT_FIELDS } from '@my-portfolyo/shared';
import { ValidationError } from '../../lib/httpError.js';

/** Kayıttaki hotspot'lar; eksik olan DB varsayılanı (0). */
export const hotspotsOf = (record) =>
  Object.fromEntries(HOTSPOT_FIELDS.map((f) => [f, record[f] ?? 0]));

/**
 * @param {Record<string, number>} values dört hotspot alanı
 * @param {{ normal: { width: number|null, height: number|null },
 *   click: { width: number|null, height: number|null } }} assets
 */
export function assertHotspots(values, assets) {
  const issues = [];
  for (const slot of ['normal', 'click']) {
    const { width, height } = assets[slot] ?? {};
    const checks = [
      [`${slot}HotspotX`, width],
      [`${slot}HotspotY`, height],
    ];
    for (const [field, limit] of checks) {
      if (limit != null && values[field] >= limit) {
        issues.push({
          path: field,
          message: `Hotspot görsel sınırları içinde olmalı (0–${limit - 1}).`,
        });
      }
    }
  }
  if (issues.length > 0) throw new ValidationError(issues);
}
