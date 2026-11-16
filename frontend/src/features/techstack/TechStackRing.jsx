// FR-PUB-04B, ROADMAP F21 tasarımı — referans görselin düzeni: siyah zemin, N daire çember üzerinde
// (tepeden saat yönü), daireleri birleştiren çift raylı gri çokgen, kenarda sıra rozeti, altta etiket,
// merkezde 3 satırlık başlık ("7" / eğik çizgiler arasında "Tech" / taranmış "Stack").
// Ölçüler container query (cqw) ile: her genişlikte oranlar aynı kalır. Öğeye tıklama → açıklama.
import '@fontsource-variable/playfair-display/index.css';
import { useId, useState, useSyncExternalStore } from 'react';
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

/** i. öğenin konumu (% genişlik / % yükseklik) ve dışa bakan açı. */
export function ringPosition(i, n) {
  const angle = -90 + (360 / n) * i;
  return {
    angle,
    x: 50 + RADIUS_X * Math.cos(rad(angle)),
    y: 50 + RADIUS_Y * Math.sin(rad(angle)),
  };
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

function CenterTitle({ title, inline = false }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none text-center select-none',
        inline
          ? 'relative mx-auto w-[78%]'
          : 'absolute top-[46%] left-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2',
      )}
      style={{ fontFamily: SERIF }}
    >
      {title.top && (
        <span
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
        <span className="absolute inset-x-[7%] top-0 block h-[0.35cqw] rounded-full bg-foreground/80" />
        <span
          className="block py-[1.4cqw] leading-none font-extrabold text-foreground italic"
          style={{ fontSize: '7.6cqw' }}
        >
          {title.main}
        </span>
        <span className="absolute inset-x-[7%] bottom-0 block h-[0.35cqw] rounded-full bg-foreground/80" />
      </span>
      {title.bottom && <HatchedWord text={title.bottom} />}
    </div>
  );
}

function Rails({ points }) {
  if (points.length < 2) return null;
  const pts = points.map((p) => `${p.x},${p.y / ASPECT}`).join(' ');
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${100 / ASPECT}`}
      className="absolute inset-0 size-full"
      preserveAspectRatio="none"
    >
      <polygon points={pts} fill="none" stroke="#8a8a8a" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon
        points={pts}
        fill="none"
        stroke="var(--background)"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
      <polygon points={pts} fill="none" stroke="#3d3d3d" strokeWidth="0.3" strokeLinejoin="round" />
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

/**
 * @param {{ title: {top:string, main:string, bottom:string},
 *   items: {id:number, label:string, description:string, image?: {url:string}|null}[],
 *   renderImage?: (item: object) => import('react').ReactNode, className?: string }} props
 */
function RingLayout({ title, items, renderImage, className }) {
  const [open, setOpen] = useState(null);
  const n = items.length;
  const positions = items.map((_, i) => ringPosition(i, n));

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[976px] overflow-x-clip text-foreground [container-type:inline-size]',
        className,
      )}
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <Rails points={positions} />
      <CenterTitle title={title} />

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
