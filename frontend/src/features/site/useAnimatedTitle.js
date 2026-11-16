// SRS FR-TAB-01 — sekme başlığı harf harf yazılıp silinir (1 sn adım), her döngüde sona rastgele emoji.
// Sayfaya özel başlığı olan sayfalar (proje detayı, indirme, yasal) bu hook'u kullanmaz.
import { useEffect } from 'react';

export const TITLE_EMOJIS = Object.freeze([
  ...'😎🥰😍🤩😪😴🤑😖🤯🥸👻👽👾💀🙈🙉🙊🐱🐶🦊🐨🐼🐣👀✨🎈🎃🎀👑🍥🍩🍻🥂🌇🌆⭐🌀⚡🌠🔥💝💖💫💭',
  '☠️',
  '♨️',
  '☄️',
  '❤️‍🩹',
  '❤️‍🔥',
  '♾️',
]);

const STEP_MS = 1000;

/** Grafem dizisi (emoji/birleşik karakter bölünmez). */
export function graphemesOf(text) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter('tr', { granularity: 'grapheme' }).segment(text)].map(
      (s) => s.segment,
    );
  }
  return Array.from(text);
}

/** Kozmetik rastgelelik; yine de Math.random yerine crypto (RULES). */
export function randomEmoji(list = TITLE_EMOJIS) {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

/**
 * Döngü uzunlukları: 1..n..1 (en az 1 harf). n=3 → [1,2,3,2] (sonra yeniden 1).
 * @param {number} n
 */
export function lengthsOf(n) {
  if (n <= 1) return [1];
  const up = Array.from({ length: n }, (_, i) => i + 1);
  const down = up.slice(1, -1).reverse();
  return [...up, ...down];
}

/** @param {string|null|undefined} title */
export function useAnimatedTitle(title) {
  useEffect(() => {
    const text = (title ?? '').trim();
    if (!text) return undefined;
    const chars = graphemesOf(text);
    const lengths = lengthsOf(chars.length);
    let step = 0;
    let emoji = randomEmoji();
    const render = () => {
      document.title = `${chars.slice(0, lengths[step]).join('')} ${emoji}`;
    };
    render();
    const id = setInterval(() => {
      step = (step + 1) % lengths.length;
      if (step === 0) emoji = randomEmoji();
      render();
    }, STEP_MS);
    return () => {
      clearInterval(id);
      document.title = text;
    };
  }, [title]);
}
