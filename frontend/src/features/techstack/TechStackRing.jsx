// FR-PUB-04B, ROADMAP F21 tasarımı — referans görselin düzeni: siyah zemin, N daire çember üzerinde
// (tepeden saat yönü), daireleri birleştiren çift raylı gri çokgen, kenarda sıra rozeti, altta etiket,
// merkezde 3 satırlık başlık ("My" / eğik çizgiler arasında "Tech" / taranmış "Stack").
// Ölçüler container query (cqw) ile: her genişlikte oranlar aynı kalır. Öğeye tıklama → açıklama.
import '@fontsource-variable/playfair-display/index.css';
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Stagger, StaggerItem } from '@/features/motion/Reveal.jsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx';
import { cn } from '@/lib/utils';

// Referans görsel 976×1092: merkez (%50, %50); yarıçap yatayda %35, dikeyde %32,2 (ölçülmüş).
const W = 976;
const H = 1092;
const ASPECT = W / H;
const RADIUS_X = 35; // % genişlik (referans ölçümü)
const RADIUS_Y = 32.2; // % yükseklik (referans ölçümü)
const CIRCLE = 22.2; // daire çapı, % genişlik
const BADGE = 4.6; // numara rozeti çapı, % genişlik
const SERIF = '"Playfair Display Variable", Georgia, serif';

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Düz çift ray yalnızca bu sayıdan itibaren: kenarın merkeze uzaklığı RADIUS_X·cos(180°/n);
 * n = 4'te %24,7 (başlığın yarı genişliği %26 → çakışır), n = 5'te %28,3 (açıkta).
 */
export const MIN_POLYGON_ITEMS = 5;

/** 1–2 öğede halka yok: daireler başlığın altında yatay bir sırada (başlığa değmez). */
const ROW_Y = 78; // % yükseklik
const ROW_GAP_X = 20; // iki öğe: merkezden ±% genişlik

/** i. öğenin konumu (% genişlik / % yükseklik) ve dışa bakan açı. */
export function ringPosition(i, n) {
  if (n <= 2) {
    const x = n === 1 ? 50 : 50 + (i === 0 ? -ROW_GAP_X : ROW_GAP_X);
    // Rozet sol üst / sağ üst çaprazda (badgeAngle: sin > 0.5 dalı) → etikete çarpmaz.
    return { angle: i === 0 && n === 2 ? 135 : 45, x, y: ROW_Y };
  }
  const angle = -90 + (360 / n) * i;
  return {
    angle,
    x: 50 + RADIUS_X * Math.cos(rad(angle)),
    y: 50 + RADIUS_Y * Math.sin(rad(angle)),
  };
}

/** Ray biçimi: 5+ çokgen (referans), 3–4 çember yayı (başlığın etrafından döner), 2 düz çizgi, 1 yok. */
export function railShape(n) {
  if (n >= MIN_POLYGON_ITEMS) return 'polygon';
  if (n >= 3) return 'arc';
  if (n === 2) return 'line';
  return 'none';
}

/** Rozet açısı (referanstaki 1–7 yerleşimi): tepedeki öğe üstte; alt yarıdakiler etikete
 * çarpmasın diye yukarı çaprazda; üst çaprazdakiler yatayda. */
export function badgeAngle(angle) {
  const a = ((angle % 360) + 360) % 360;
  const sin = Math.sin(rad(a));
  const cos = Math.cos(rad(a));
  if (sin < -0.95) return -90;
  if (sin > 0.5) return cos >= 0 ? -35 : -145;
  if (sin < -0.2) return cos >= 0 ? 0 : 180;
  return a;
}

/** Taranmış dış hatlı kelime (referanstaki "Stack"): SVG desen dolgusu + çizgi. background-clip:text
 * yerine SVG — ata öğelerdeki filtre/transform animasyonlarında kaybolmaz, her tarayıcıda aynı. */
function HatchedWord({ text }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 500 120"
      className="mx-auto block w-full overflow-visible text-foreground"
      style={{ marginTop: '0.5cqw' }}
    >
      <defs>
        <pattern
          id={`hatch-${id}`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(32)"
        >
          <rect width="2.4" height="7" fill="currentColor" />
        </pattern>
      </defs>
      <text
        x="50%"
        y="96"
        textAnchor="middle"
        fontFamily={SERIF}
        fontWeight="700"
        fontSize="118"
        fill={`url(#hatch-${id})`}
        stroke="currentColor"
        strokeWidth="2.2"
        paintOrder="stroke"
        textLength={text.length > 6 ? 460 : undefined}
        lengthAdjust="spacingAndGlyphs"
      >
        {text}
      </text>
    </svg>
  );
}

function CenterTitle({ title, inline = false, ref, scale = 1 }) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        'pointer-events-none text-center select-none',
        inline
          ? 'relative mx-auto w-[78%]'
          : 'absolute top-[46%] left-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2',
      )}
      style={{ fontFamily: SERIF, scale: scale === 1 ? undefined : String(scale) }}
    >
      {title.top && (
        <span
          data-fit="word"
          className="block text-left leading-none font-black text-foreground italic"
          style={{
            fontSize: '14cqw',
            marginLeft: '12%',
            transform: 'rotate(-4deg)',
            textShadow:
              '0.5cqw 0.6cqw 0 color-mix(in oklch, var(--foreground) 45%, transparent), 0.9cqw 1.1cqw 0 color-mix(in oklch, var(--foreground) 18%, transparent)',
          }}
        >
          {title.top}
        </span>
      )}
      <span
        // Dar ekranda eğik alt çizgi "Stack" ile temas etmesin diye alt boşluk.
        className={cn('relative block', inline ? 'mt-[0.5cqw] mb-[6cqw]' : 'my-[0.5cqw]')}
        style={{ transform: 'rotate(-9deg)' }}
      >
        <span
          data-fit="line"
          className="absolute inset-x-[7%] top-0 block h-[0.35cqw] rounded-full bg-foreground/80"
        />
        <span
          data-fit="word"
          className="block py-[1.4cqw] leading-none font-extrabold text-foreground italic"
          style={{ fontSize: '7.6cqw' }}
        >
          {title.main}
        </span>
        <span
          data-fit="line"
          className="absolute inset-x-[7%] bottom-0 block h-[0.35cqw] rounded-full bg-foreground/80"
        />
      </span>
      {title.bottom && <HatchedWord text={title.bottom} />}
    </div>
  );
}

// Çift ray = aynı şeklin üç katmanı: gri dış, zemin rengi boşluk, koyu orta çizgi.
const RAIL_LAYERS = [
  { stroke: '#8a8a8a', width: 1.5 },
  { stroke: 'var(--background)', width: 0.75 },
  { stroke: '#3d3d3d', width: 0.3 },
];

function Rails({ points }) {
  const shape = railShape(points.length);
  if (shape === 'none') return null;
  // SVG birimleri: x = % genişlik, y = % yükseklik / ASPECT (iki eksen aynı ölçekte).
  const pts = points.map((p) => `${p.x},${p.y / ASPECT}`).join(' ');
  const layer = ({ stroke, width }) => {
    const common = { fill: 'none', stroke, strokeWidth: width };
    if (shape === 'arc') {
      // Daireler çemberin üzerinde: ardışık yayların toplamı tam elips; köşeleri daireler örter.
      return (
        <ellipse
          key={stroke}
          {...common}
          cx="50"
          cy={50 / ASPECT}
          rx={RADIUS_X}
          ry={RADIUS_Y / ASPECT}
        />
      );
    }
    if (shape === 'line') {
      return <polyline key={stroke} {...common} points={pts} strokeLinecap="round" />;
    }
    return <polygon key={stroke} {...common} points={pts} strokeLinejoin="round" />;
  };
  return (
    <svg
      aria-hidden="true"
      data-rail={shape}
      viewBox={`0 0 100 ${100 / ASPECT}`}
      className="absolute inset-0 size-full"
      preserveAspectRatio="none"
    >
      {RAIL_LAYERS.map(layer)}
    </svg>
  );
}

function Initial({ label }) {
  return (
    <span
      className="grid size-full place-items-center font-bold text-foreground"
      style={{ fontSize: '8cqw', fontFamily: SERIF }}
    >
      {label.slice(0, 1).toLocaleUpperCase('tr-TR')}
    </span>
  );
}

// ───────────────────────── Başlığı halkanın içine sığdırma ─────────────────────────

const MIN_TITLE_SCALE = 0.45;

/**
 * Başlığın gerçek mürekkep alanı, kapsayıcıya göre px. Kelimeler glif sınırıyla (Range) ölçülür;
 * "Tech" satırının eğik çizgileri dış kutunun köşegeni (sol alt → sağ üst) olarak tutulur —
 * eğik bir çizginin dış kutusunun köşeleri boştur, kutu olarak ölçmek başlığı gereksiz küçültürdü.
 */
function titleInk(titleEl, origin) {
  const parts = [];
  const push = (r, kind) =>
    r.width > 0 &&
    parts.push({
      kind,
      l: r.left - origin.left,
      t: r.top - origin.top,
      r: r.right - origin.left,
      b: r.bottom - origin.top,
    });
  for (const el of titleEl.querySelectorAll('[data-fit="word"]')) {
    const range = document.createRange();
    range.selectNodeContents(el);
    push(range.getBoundingClientRect(), 'rect');
  }
  for (const el of titleEl.querySelectorAll('[data-fit="line"]')) {
    push(el.getBoundingClientRect(), 'line');
  }
  for (const el of titleEl.querySelectorAll('svg text')) {
    push(el.getBoundingClientRect(), 'rect');
  }
  return parts;
}

const intersects = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const inRect = (x, y, o) => x > o.l && x < o.r && y > o.t && y < o.b;

/** Test noktaları: dikdörtgende köşeler + kenar ortaları, çizgide köşegen boyunca 11 nokta. */
function samplePoints(p) {
  if (p.kind === 'line') {
    return Array.from({ length: 11 }, (_, k) => [
      p.l + ((p.r - p.l) * k) / 10,
      p.b - ((p.b - p.t) * k) / 10,
    ]);
  }
  const mx = (p.l + p.r) / 2;
  const my = (p.t + p.b) / 2;
  return [
    [p.l, p.t],
    [p.r, p.t],
    [p.l, p.b],
    [p.r, p.b],
    [mx, p.t],
    [mx, p.b],
    [p.l, my],
    [p.r, my],
  ];
}

/** Dikdörtgen ile daire kesişiyor mu (en yakın nokta testi)? */
const rectHitsCircle = (p, c) => {
  const x = Math.min(Math.max(c.x, p.l), p.r);
  const y = Math.min(Math.max(c.y, p.t), p.b);
  return Math.hypot(c.x - x, c.y - y) < c.r;
};

/** Engel: daireler gerçek daire, etiketler yazının glif kutusu. */
function hits(p, pts, o) {
  if (o.r !== undefined && o.x !== undefined) {
    return p.kind === 'line'
      ? pts.some(([x, y]) => Math.hypot(x - o.x, y - o.y) < o.r)
      : rectHitsCircle(p, o);
  }
  return p.kind === 'line' ? pts.some(([x, y]) => inRect(x, y, o.box)) : intersects(p, o.box);
}

/** Başlık parçaları rayın içinde ve daire/etiketlerin dışında mı? */
function titleFits(parts, { inside, obstacles }) {
  return parts.every((p) => {
    const pts = samplePoints(p);
    if (!pts.every(([x, y]) => inside(x, y))) return false;
    return obstacles.every((o) => !hits(p, pts, o));
  });
}

/** Rayın iç bölgesi (kenara en az margin px içeride) için nokta testi. */
function railInside(shape, pts, W, H, margin) {
  if (shape === 'polygon') {
    // Dışbükey çokgen, ekran koordinatında saat yönü: her kenarın iç tarafında ≥ margin.
    return (x, y) =>
      pts.every(([x1, y1], i) => {
        const [x2, y2] = pts[(i + 1) % pts.length];
        const len = Math.hypot(x2 - x1, y2 - y1);
        return ((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)) / len >= margin;
      });
  }
  if (shape === 'arc') {
    const rx = (RADIUS_X * W) / 100 - margin;
    const ry = (RADIUS_Y * H) / 100 - margin;
    return (x, y) => ((x - W / 2) / rx) ** 2 + ((y - H / 2) / ry) ** 2 <= 1;
  }
  if (shape === 'line') return (_x, y) => y <= pts[0][1] - margin;
  return () => true;
}

/**
 * Başlık admin'den değişebilir ("7", "My", uzun bir kelime…): sabit eşik yerine çizimden sonra
 * gerçek geometri ölçülür ve başlık; raya, dairelere ve etiketlere değmeyecek en büyük ölçeğe
 * indirilir (hiç büyütülmez). Kapsayıcı boyutu veya yazı tipi değişince yeniden ölçülür.
 */
function useTitleFit(boxRef, titleRef, positions, key) {
  const [scale, setScale] = useState(1);
  const latest = useRef(positions);
  latest.current = positions;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const titleEl = titleRef.current;
    if (!box || !titleEl) return undefined;

    const measure = () => {
      const pos = latest.current;
      const o = box.getBoundingClientRect();
      const W = o.width;
      const H = o.height;
      if (!W || !H) return;
      const t = titleEl.getBoundingClientRect();
      const current = Number(titleEl.style.scale || 1);
      const cx = (t.left + t.right) / 2 - o.left;
      const cy = (t.top + t.bottom) / 2 - o.top;
      const at = (rects, k) =>
        rects.map((r) => ({
          kind: r.kind,
          l: cx + (r.l - cx) * k,
          r: cx + (r.r - cx) * k,
          t: cy + (r.t - cy) * k,
          b: cy + (r.b - cy) * k,
        }));
      // Mevcut ölçekten bağımsız (scale = 1) dikdörtgenler.
      const base = at(titleInk(titleEl, o), 1 / current);

      const margin = W * 0.02; // ray kalınlığı + nefes payı
      const pts = pos.map((p) => [(p.x * W) / 100, (p.y * H) / 100]);
      const inside = railInside(railShape(pos.length), pts, W, H, margin);
      const pad = margin / 2;
      const circles = [...box.querySelectorAll('.tech-item-circle')].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: (r.left + r.right) / 2 - o.left,
          y: (r.top + r.bottom) / 2 - o.top,
          r: r.width / 2 + pad,
        };
      });
      // Etiket öğesi dairenin %150'si genişliğinde: engel olarak yalnızca yazının kendisi.
      const labels = [...box.querySelectorAll('.tech-item-label')].map((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return {
          box: {
            l: r.left - o.left - pad,
            t: r.top - o.top - pad,
            r: r.right - o.left + pad,
            b: r.bottom - o.top + pad,
          },
        };
      });
      const obstacles = [...circles, ...labels];
      const env = { inside, obstacles };

      let next = 1;
      if (!titleFits(at(base, 1), env)) {
        let lo = MIN_TITLE_SCALE;
        let hi = 1;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2;
          if (titleFits(at(base, mid), env)) lo = mid;
          else hi = mid;
        }
        next = Math.floor(lo * 100) / 100;
      }
      setScale((prev) => (Math.abs(prev - next) < 0.01 ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [boxRef, titleRef, key]);

  return scale;
}

/**
 * @param {{ title: {top:string, main:string, bottom:string},
 *   items: {id:number, label:string, description:string, image?: {url:string}|null}[],
 *   renderImage?: (item: object) => import('react').ReactNode, className?: string }} props
 */
function RingLayout({ title, items, renderImage, className }) {
  const [open, setOpen] = useState(null);
  const n = items.length;
  const positions = items.map((_, i) => ringPosition(i, n));
  const boxRef = useRef(null);
  const titleRef = useRef(null);
  // Öğe sayısı, etiketler veya başlık metni değişince yeniden ölç.
  const fitKey = [n, ...items.map((i) => i.label), title.top, title.main, title.bottom].join('|');
  const titleScale = useTitleFit(boxRef, titleRef, positions, fitKey);

  return (
    <div
      ref={boxRef}
      className={cn(
        'relative mx-auto w-full max-w-[976px] overflow-x-clip text-foreground [container-type:inline-size]',
        className,
      )}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <Rails points={positions} />
      <CenterTitle ref={titleRef} title={title} scale={titleScale} />

      <ol
        className="absolute inset-0 m-0 list-none p-0"
        aria-label={[title.top, title.main, title.bottom].filter(Boolean).join(' ')}
      >
        {items.map((item, i) => {
          const { x, y, angle } = positions[i];
          const b = badgeAngle(angle);
          const r = CIRCLE / 2;
          const badgeX = Math.cos(rad(b)) * r;
          const badgeY = Math.sin(rad(b)) * r;
          const shiftX = Math.cos(rad(angle)) * CIRCLE * 0.18;
          return (
            <li
              key={item.id}
              className="absolute z-[1] hover:z-[3] focus-within:z-[3]"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${CIRCLE}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Popover open={open === item.id} onOpenChange={(o) => setOpen(o ? item.id : null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="group tech-item relative block w-full cursor-pointer rounded-full outline-none"
                    aria-label={`${i + 1}. ${item.label}: açıklamayı göster`}
                  >
                    <span className="tech-item-circle relative block aspect-square w-full overflow-hidden rounded-full border-[0.25cqw] border-foreground/70 bg-black">
                      {renderImage ? (
                        renderImage(item)
                      ) : item.image?.url ? (
                        <img
                          src={item.image.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Initial label={item.label} />
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className="absolute grid place-items-center rounded-full border-[0.25cqw] border-foreground bg-background leading-none font-semibold text-foreground"
                      style={{
                        width: `${(BADGE / CIRCLE) * 100}%`,
                        aspectRatio: '1',
                        fontSize: '2.6cqw',
                        left: `${50 + (badgeX / CIRCLE) * 100}%`,
                        top: `${50 + (badgeY / CIRCLE) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      aria-hidden="true"
                      className="tech-item-label absolute top-full left-1/2 block w-[150%] leading-tight font-semibold whitespace-pre-line text-foreground"
                      style={{
                        fontSize: '3.1cqw',
                        marginTop: '0.6cqw',
                        transform: `translateX(calc(-50% + ${shiftX}cqw))`,
                        fontFamily: SERIF,
                        textShadow: '0 0.2cqw 0.6cqw var(--background)',
                      }}
                    >
                      {item.label.replace(' / ', '\n/ ')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="center" className="w-80 max-w-[90vw]">
                  <p className="text-muted-foreground mb-1 text-xs">#{i + 1}</p>
                  <p className="mb-2 font-semibold">{item.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {item.description || 'Açıklama yakında eklenecek.'}
                  </p>
                </PopoverContent>
              </Popover>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ───────────────────────── Dar ekran: alt alta (zaman çizelgesi) ─────────────────────────

const WIDE_QUERY = '(min-width: 768px)';
const subscribe = (cb) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const wideNow = () =>
  typeof window === 'undefined' || !window.matchMedia
    ? true
    : window.matchMedia(WIDE_QUERY).matches;

function ItemImage({ item, renderImage }) {
  if (renderImage) return renderImage(item);
  if (item.image?.url) {
    return <img src={item.image.url} alt="" loading="lazy" className="size-full object-cover" />;
  }
  return <Initial label={item.label} />;
}

function StackedLayout({ title, items, renderImage, className }) {
  return (
    <div className={cn('mx-auto w-full max-w-[560px] text-foreground', className)}>
      {/* Dar ekranda okunurluk: başlık ve öğeler cam kutularda (arka plan/tema ne olursa olsun). */}
      <div
        className="surface-chrome rounded-[var(--radius-lg)] border px-4 py-7 [container-type:inline-size]"
        style={{ fontFamily: SERIF }}
      >
        <CenterTitle title={title} inline />
      </div>
      <Stagger
        as="ol"
        className="relative mt-6 grid list-none gap-4 p-0"
        aria-label={[title.top, title.main, title.bottom].filter(Boolean).join(' ')}
      >
        {/* Referanstaki çift ray: daireleri dikeyde bağlar */}
        <span
          aria-hidden="true"
          className="absolute top-12 bottom-12 left-[49px] w-[6px] rounded-full border-x-2 border-[#8a8a8a]"
        />
        {items.map((item, i) => (
          <StaggerItem
            as="li"
            key={item.id}
            className="surface-chrome relative flex items-start gap-4 rounded-[var(--radius-lg)] border p-3"
          >
            <span className="relative shrink-0">
              <span className="relative block size-[80px] overflow-hidden rounded-full border-2 border-foreground/70 bg-black">
                <ItemImage item={item} renderImage={renderImage} />
              </span>
              <span
                aria-hidden="true"
                className="border-foreground bg-background absolute -top-1 -left-1 grid size-7 place-items-center rounded-full border-2 text-sm leading-none font-semibold"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {i + 1}
              </span>
            </span>
            <span className="min-w-0 flex-1 pt-2">
              <span
                className="block text-xl leading-tight font-semibold"
                style={{ fontFamily: SERIF }}
              >
                <span className="sr-only">{i + 1}. </span>
                {item.label}
              </span>
              {item.description && (
                <span className="text-muted-foreground mt-1 block text-sm leading-relaxed whitespace-pre-wrap">
                  {item.description}
                </span>
              )}
            </span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

/**
 * Geniş ekranda referans halka düzeni, dar ekranda (< 768 px) alt alta liste.
 * @param {{ layout?: 'auto'|'ring'|'list' } & Parameters<typeof RingLayout>[0]} props
 */
export function TechStackRing({ layout = 'auto', ...props }) {
  const wide = useSyncExternalStore(subscribe, wideNow, () => true);
  const useRing = layout === 'ring' || (layout === 'auto' && wide);
  return useRing ? <RingLayout {...props} /> : <StackedLayout {...props} />;
}
