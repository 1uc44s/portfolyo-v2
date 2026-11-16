// RULES §8.6 "İsim efektleri" (2026-11-16): NEON, GRADIENT (hareketsiz), GRADIENT_ANIMATED (soldan sağa
// akan), OVERLAY (günün isim GIF'i, Hero.jsx). İki gradyan aynı iki rengi kullanır (sol → sağ).
// Public Hero ve admin önizlemesi aynı stili kullanır.
export const DEFAULT_GRADIENT = Object.freeze({ from: '#a78bfa', to: '#f472b6' });

/**
 * @param {string[]} effects
 * @param {{ from?: string, to?: string }} [options]
 */
export function nameStyle(effects = [], { from, to } = {}) {
  const neon = effects.includes('NEON');
  const animated = effects.includes('GRADIENT_ANIMATED');
  const gradient = animated || effects.includes('GRADIENT');
  const left = from || DEFAULT_GRADIENT.from;
  const right = to || DEFAULT_GRADIENT.to;
  return {
    ...(gradient && {
      // Hareketli: renk döngüsü (sol → sağ → sol) 200% genişlikte kayar; dikiş görünmez.
      backgroundImage: animated
        ? `linear-gradient(90deg, ${left}, ${right}, ${left})`
        : `linear-gradient(90deg, ${left}, ${right})`,
      backgroundSize: animated ? '200% 100%' : undefined,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    }),
    ...(neon &&
      (gradient
        ? { filter: 'drop-shadow(0 0 10px var(--accent-glow))' }
        : {
            textShadow:
              '0 0 6px var(--accent-glow), 0 0 18px var(--accent-glow), 0 0 42px var(--accent-glow)',
          })),
  };
}

/**
 * Hareketli gradyan sınıfı: animasyon CSS'te (globals.css) — yalnızca renk akışı olduğu için azaltılmış
 * hareket / düşük efekt modunda da çalışır (2026-11-16 kullanıcı isteği).
 */
export const nameClass = (effects = []) =>
  effects.includes('GRADIENT_ANIMATED') ? 'name-gradient-animated' : '';

/** İlk harf (Türkçe büyük harf kuralı: i → İ). */
export function initialOf(name) {
  const first = Array.from((name ?? '').trim())[0];
  return first ? first.toLocaleUpperCase('tr-TR') : '?';
}
