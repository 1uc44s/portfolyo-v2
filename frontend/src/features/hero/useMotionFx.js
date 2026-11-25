// sürekli animasyonlu efektler (parçacık, yıldız) şu durumlarda kapalı:
// effects=low, prefers-reduced-motion, ya da dokunmatik + düşük çekirdekli cihaz (≤ 4).
import { useSyncExternalStore } from 'react';
import { usePrefs } from '@/lib/prefs.js';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribe = (callback) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
};
const reducedSnapshot = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;

export const weakTouchDevice = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  return coarse && cores <= 4;
};

/** @param {boolean} [forceLow] admin önizlemesindeki "düşük efekt" anahtarı */
export function useMotionFx(forceLow = false) {
  const low = usePrefs((s) => s.effects === 'low');
  const reduced = useSyncExternalStore(subscribe, reducedSnapshot, () => false);
  return !(forceLow || low || reduced || weakTouchDevice());
}
