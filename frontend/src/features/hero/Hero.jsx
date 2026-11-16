// FR-HERO-01..04, RULES §8.6 — profil (144 / mobil 112 px, 3 px halka), isim, slogan, konum.
// Profil yoksa baş harf avatarı. Efekt katmanları aria-hidden; isim tek başına okunur.
// Public ana sayfa ve admin canlı önizlemesi aynı bileşeni kullanır (`as`, `forceLowEffects`).
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePrefs } from '@/lib/prefs.js';
import { initialOf, nameClass, nameStyle } from './nameEffects.js';

const RING =
  'size-28 rounded-full border-[3px] border-[var(--border-strong)] object-cover sm:size-36';

function Avatar({ profile, name, lowEffects }) {
  if (profile?.url) {
    if (profile.type === 'VIDEO') {
      if (lowEffects && profile.posterUrl) {
        return <img src={profile.posterUrl} alt="" width={144} height={144} className={RING} />;
      }
      return (
        <video
          src={profile.url}
          poster={profile.posterUrl ?? undefined}
          muted
          loop
          playsInline
          autoPlay={!lowEffects}
          aria-hidden="true"
          className={RING}
        />
      );
    }
    return <img src={profile.url} alt="" width={144} height={144} className={RING} />;
  }
  return (
    <div
      aria-hidden="true"
      data-testid="hero-initial"
      className={cn(RING, 'bg-surface-3 type-h1 grid place-items-center')}
    >
      {initialOf(name)}
    </div>
  );
}

const PRESENCE = {
  online: ['bg-status-online', 'Çevrimiçi'],
  idle: ['bg-status-idle', 'Boşta'],
  dnd: ['bg-status-dnd', 'Rahatsız etmeyin'],
  offline: ['bg-status-offline', 'Çevrimdışı'],
};

/** `presence`: Discord durumu (FR-INT-08); yoksa nokta gösterilmez. */
export function Hero({ hero, as: Heading = 'h1', forceLowEffects = false, className, presence }) {
  const lowEffects = usePrefs((s) => s.effects === 'low') || forceLowEffects;
  const effects = hero?.nameEffects ?? [];
  const name = hero?.displayName || 'Lucas Vasquez';

  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="relative">
        <Avatar profile={hero?.profile} name={name} lowEffects={lowEffects} />
        {PRESENCE[presence] && (
          <span
            role="img"
            aria-label={`Discord: ${PRESENCE[presence][1]}`}
            title={PRESENCE[presence][1]}
            className={cn(
              'ring-background absolute right-[6%] bottom-[6%] size-5 rounded-full ring-4 sm:size-6',
              PRESENCE[presence][0],
            )}
          />
        )}
      </div>
      <div className="relative mt-4 max-w-full">
        <Heading
          className={cn('type-hero relative break-words', nameClass(effects))}
          style={nameStyle(effects, {
            from: hero?.gradientFrom,
            to: hero?.gradientTo,
          })}
        >
          {name}
        </Heading>
        {/* FR-HERO-05 — günün isim GIF'i ismin üstünde. Sitenin efekt düğmesine bağlı: açıkken (işletim
            sistemi "hareket azalt" olsa da) görünür, kapalıyken gizlenir. */}
        {!lowEffects && effects.includes('OVERLAY') && hero?.overlayUrl && (
          <img
            src={hero.overlayUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            className="pointer-events-none absolute top-[-20%] left-[-8%] z-10 h-[140%] w-[116%] max-w-none object-cover select-none"
          />
        )}
      </div>
      {/* Arka plan ne olursa olsun okunur: slogan ve konum cam kutularda (2026-11-16). */}
      {hero?.tagline && (
        <p className="surface-chrome text-foreground/90 mt-3 max-w-md rounded-[var(--radius-lg)] border px-4 py-2 text-balance">
          {hero.tagline}
        </p>
      )}
      {hero?.location && (
        <p className="surface-chrome text-muted-foreground mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
          <MapPin aria-hidden="true" className="size-4" />
          {hero.location}
        </p>
      )}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-4">
      <div className="bg-muted size-28 animate-pulse rounded-full sm:size-36" />
      <div className="bg-muted h-14 w-72 max-w-full animate-pulse rounded-[var(--radius-md)]" />
      <div className="bg-muted h-4 w-48 animate-pulse rounded-[var(--radius-sm)]" />
    </div>
  );
}
