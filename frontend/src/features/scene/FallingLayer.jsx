// aktif yağan öğelerin hepsi birlikte yukarıdan aşağı yağar (görsel veya metin).
// Tıklamayı engellemez, aria-hidden. CSS animasyonu; azaltılmış harekette de gösterilir (kullanıcı isteği).
// Konum/süre tohumlu sözde rastgele: aynı liste her renderda aynı düzeni verir (titreme yok).
import { useMemo } from 'react';
import { useSite } from '@/features/site/useSite.js';
import { usePrefs } from '@/lib/prefs.js';
import { useWelcome } from '@/features/welcome/welcomeStore.js';

const MAX_PARTICLES = 30;
const PER_ITEM_MAX = 12;

/** mulberry32 — küçük, deterministik PRNG (kozmetik; güvenlik amaçlı değil). */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Öğe listesinden tanecik düzeni: toplam ≤ 30, öğelere eşit dağıtılır. */
export function buildParticles(items) {
  if (!items?.length) return [];
  const perItem = Math.max(1, Math.min(PER_ITEM_MAX, Math.floor(MAX_PARTICLES / items.length)));
  const rand = prng(items.reduce((acc, it) => acc * 31 + it.id, 7));
  const out = [];
  for (const item of items) {
    for (let i = 0; i < perItem; i += 1) {
      const duration = 9 + rand() * 9; // 9–18 sn
      out.push({
        key: `${item.id}-${i}`,
        item,
        left: rand() * 100,
        duration,
        // Pozitif gecikme: her tanecik en tepeden başlar (ortadan değil); döngü boyunca kademeli yağar.
        delay: rand() * duration,
        drift: (rand() - 0.5) * 120,
        spin: (rand() - 0.5) * 540,
        scale: 0.7 + rand() * 0.6,
        opacity: 0.55 + rand() * 0.45,
      });
    }
  }
  return out;
}

function Piece({ p }) {
  const size = Math.round(p.item.size * p.scale);
  const style = {
    left: `${p.left}%`,
    opacity: p.opacity,
    '--fall-duration': `${p.duration.toFixed(2)}s`,
    '--fall-delay': `${p.delay.toFixed(2)}s`,
    '--fall-drift': `${p.drift.toFixed(0)}px`,
    '--fall-spin': `${p.spin.toFixed(0)}deg`,
  };
  return p.item.type === 'IMAGE' ? (
    <img
      src={p.item.url}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="falling-piece object-contain"
      style={{ ...style, width: size, height: size }}
    />
  ) : (
    <span
      className="falling-piece leading-none whitespace-nowrap"
      style={{ ...style, fontSize: size }}
    >
      {p.item.text}
    </span>
  );
}

export function FallingLayer() {
  const { data } = useSite();
  // Sitenin efekt düğmesine bağlı: açıkken (işletim sistemi "hareket azalt" olsa da) yağar, kapalıyken durur.
  const low = usePrefs((s) => s.effects === 'low');
  // Karşılama ekranı geçilene kadar beklenir; tıklayınca (ve efekt açılınca) katman yeniden mount olup
  // yağış en tepeden başlar.
  const entered = useWelcome((s) => s.entered);
  const particles = useMemo(() => buildParticles(data?.falling), [data?.falling]);
  if (low || !entered || particles.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="falling-layer"
      className="pointer-events-none fixed inset-0 z-[5] overflow-hidden select-none"
    >
      {particles.map((p) => (
        <Piece key={p.key} p={p} />
      ))}
    </div>
  );
}
