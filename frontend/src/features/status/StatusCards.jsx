// US-04, FR-INT-01..08 — Discord / Spotify / GitHub durum kartları (bento). Her kart dört durumlu:
// yükleniyor (ölçü korunur), hata ("Şu an alınamıyor"), boş, başarılı. Kapalı sağlayıcı render edilmez.
// Kart görünümleri (`DiscordView` vb.) admin önizlemesinde de kullanılır.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, BookMarked, Headphones, Users } from 'lucide-react';
import { fetchStatus } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { formatRelative } from '@/lib/format.js';
import { usePrefs } from '@/lib/prefs.js';
import { cn } from '@/lib/utils';
import { DiscordView } from './DiscordProfile.jsx';
import { Stagger, StaggerItem } from '@/features/motion/Reveal.jsx';

export { DiscordView, PRESENCE_DOT, PRESENCE_LABELS } from './DiscordProfile.jsx';

export const REFRESH_MS = { discord: 60_000, spotify: 30_000, github: 60_000 };
export const SPOTIFY_IDLE = 'Şu anda müzik dinlemiyor';

/** Public durum sorgusu; `enabled=false` iken istek atılmaz. */
/** FR-INT-09 — canlı akış (SSE): snapshot değişince sorgu verisi anında güncellenir. Yoklama yedek. */
export function useLiveStatus(slug, enabled = true) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return undefined;
    const source = new EventSource(`/api/public/status/${slug}/stream`);
    const onStatus = (e) => {
      try {
        queryClient.setQueryData(queryKeys.status(slug), JSON.parse(e.data));
      } catch {
        // Bozuk olay yok sayılır; yoklama devam eder.
      }
    };
    source.addEventListener('status', onStatus);
    return () => {
      source.removeEventListener('status', onStatus);
      source.close();
    };
  }, [slug, enabled, queryClient]);
}

export function useStatus(slug, enabled = true) {
  useLiveStatus(slug, enabled && slug !== 'github'); // GitHub kartları canlı değişmez
  return useQuery({
    queryKey: queryKeys.status(slug),
    queryFn: () => fetchStatus(slug),
    enabled,
    refetchInterval: REFRESH_MS[slug],
    staleTime: REFRESH_MS[slug] / 2,
    retry: 1,
  });
}

function CardShell({ title, icon: Icon, children, footer, className }) {
  return (
    <article
      className={cn(
        'surface-chrome flex min-h-[200px] flex-col gap-4 rounded-[var(--radius-lg)] border p-5',
        className,
      )}
    >
      <header className="type-eyebrow flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4" />
        <h3>{title}</h3>
      </header>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
      {footer && <p className="text-muted-foreground text-xs">{footer}</p>}
    </article>
  );
}

function Unavailable() {
  return (
    <p className="text-muted-foreground m-auto text-center text-sm">
      Şu an alınamıyor. Biraz sonra tekrar denenecek.
    </p>
  );
}

function CardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="bg-muted size-14 animate-pulse rounded-full" />
        <div className="grid flex-1 gap-2">
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
        </div>
      </div>
      <div className="bg-muted h-10 animate-pulse rounded" />
    </div>
  );
}

const staleNote = (status) =>
  status?.stale && status?.updatedAt
    ? `Son güncelleme ${formatRelative(status.updatedAt)}`
    : undefined;

// Discord profil kartı ayrı dosyada (DiscordProfile.jsx).

// ───────────────────────────── Spotify ─────────────────────────────

/** fetchedAt + progressMs ile yerel ilerleme (FR-INT-S). */
export function useLiveProgress(nowPlaying) {
  const [now, setNow] = useState(() => Date.now());
  const playing = Boolean(nowPlaying?.isPlaying);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [playing]);
  if (!nowPlaying) return 0;
  const elapsed = playing ? Math.max(0, now - Date.parse(nowPlaying.fetchedAt)) : 0;
  return Math.min(nowPlaying.durationMs || 0, (nowPlaying.progressMs || 0) + elapsed);
}

const mmss = (ms) => {
  const total = Math.floor((ms || 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function TrackLink({ url, children, className }) {
  if (!url) return <span className={className}>{children}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('hover:underline focus-visible:underline', className)}
    >
      {children}
    </a>
  );
}

export function SpotifyView({ data }) {
  const np = data.nowPlaying;
  const progress = useLiveProgress(np);
  const pct = np?.durationMs ? (progress / np.durationMs) * 100 : 0;
  return (
    <>
      {np ? (
        <div className="flex items-center gap-3">
          {np.albumArtUrl && (
            <img
              src={np.albumArtUrl}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              className="size-16 shrink-0 rounded-[var(--radius-sm)] object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">
              {np.isPlaying ? 'Şu an dinliyor' : 'Duraklatıldı'}
            </p>
            <TrackLink url={np.trackUrl} className="block truncate font-semibold">
              {np.title}
            </TrackLink>
            <p className="text-muted-foreground truncate text-sm">{np.artists.join(', ')}</p>
            <div className="mt-2 flex items-center gap-2 text-[11px] tabular-nums">
              <span className="text-muted-foreground">{mmss(progress)}</span>
              <div
                role="progressbar"
                aria-label="Parça ilerlemesi"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                className="bg-muted h-1 flex-1 overflow-hidden rounded-full"
              >
                <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-muted-foreground">{mmss(np.durationMs)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Headphones aria-hidden="true" className="size-4" />
          {SPOTIFY_IDLE}
        </p>
      )}
      {data.topTracks?.length > 0 && (
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs">Son dönemde en çok dinlenenler</p>
          <ol className="grid gap-2">
            {data.topTracks.map((t, i) => (
              <li key={`${t.title}-${i}`} className="flex items-center gap-2 text-sm">
                {t.albumArtUrl && (
                  <img
                    src={t.albumArtUrl}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="size-8 shrink-0 rounded object-cover"
                  />
                )}
                <span className="min-w-0 truncate">
                  <TrackLink url={t.trackUrl} className="font-medium">
                    {t.title}
                  </TrackLink>
                  <span className="text-muted-foreground"> · {t.artists.join(', ')}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

// ───────────────────────────── GitHub ─────────────────────────────

export function GithubView({ data, cards }) {
  const theme = usePrefs((s) => s.theme);
  return (
    <>
      <div className="flex items-center gap-3">
        {data.avatarUrl && (
          <img
            src={data.avatarUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            className="size-14 shrink-0 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <TrackLink url={data.htmlUrl} className="block truncate font-semibold">
            {data.name || data.login}
          </TrackLink>
          <p className="text-muted-foreground truncate text-sm">@{data.login}</p>
        </div>
      </div>
      <dl className="flex gap-5 text-sm">
        <div className="flex items-center gap-1.5">
          <BookMarked aria-hidden="true" className="text-muted-foreground size-4" />
          <dt className="sr-only">Herkese açık depo</dt>
          <dd>
            <span className="font-semibold tabular-nums">{data.publicRepos}</span> depo
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Users aria-hidden="true" className="text-muted-foreground size-4" />
          <dt className="sr-only">Takipçi</dt>
          <dd>
            <span className="font-semibold tabular-nums">{data.followers}</span> takipçi
          </dd>
        </div>
      </dl>
      {cards && (
        <div className="grid gap-2">
          {[
            ['stats', 'GitHub istatistikleri'],
            ['streak', 'GitHub katkı serisi'],
          ].map(([key, alt]) => (
            <img
              key={key}
              src={`${cards[key]}?theme=${theme === 'light' ? 'light' : 'dark'}`}
              alt={alt}
              loading="lazy"
              width={key === 'stats' ? 467 : 495}
              height={195}
              className="h-auto w-full"
            />
          ))}
        </div>
      )}
    </>
  );
}

// ───────────────────────────── Bölüm ─────────────────────────────

const CARDS = [
  { slug: 'discord', title: 'Discord', icon: Activity, View: DiscordView, bare: true },
  { slug: 'spotify', title: 'Spotify', icon: Headphones, View: SpotifyView },
  { slug: 'github', title: 'GitHub', icon: BookMarked, View: GithubView },
];

export function StatusCard({ slug, title, icon, View, bare = false }) {
  const query = useStatus(slug);
  const status = query.data;
  if (status && !status.enabled) return null;
  // Discord: referans profil kartı gibi başlıksız, kenardan kenara (banner üstte).
  if (bare && status?.data && !query.isError) {
    const note = staleNote(status);
    return (
      <article className="surface-chrome flex min-h-[200px] flex-col overflow-hidden rounded-[var(--radius-lg)] border">
        <h3 className="sr-only">{title}</h3>
        <View data={status.data} cards={status.cards} />
        {note && <p className="text-muted-foreground px-5 pb-4 text-xs">{note}</p>}
      </article>
    );
  }
  return (
    <CardShell title={title} icon={icon} footer={staleNote(status)}>
      {query.isPending ? (
        <CardSkeleton />
      ) : query.isError || !status?.data ? (
        <Unavailable />
      ) : (
        <View data={status.data} cards={status.cards} />
      )}
    </CardShell>
  );
}

/** @param {{ integrations?: { discord?: boolean, spotify?: boolean, github?: boolean } }} props */
export function StatusSection({ integrations }) {
  const visible = CARDS.filter((c) => integrations?.[c.slug]);
  if (visible.length === 0) return null;
  return (
    <section
      aria-labelledby="status-title"
      className="mx-auto w-full max-w-[1200px] px-4 pb-12 sm:px-6"
    >
      <h2 id="status-title" className="sr-only">
        Şu an
      </h2>
      <Stagger
        className={cn(
          'grid gap-4',
          visible.length >= 2 && 'md:grid-cols-2',
          visible.length === 3 && 'lg:grid-cols-3',
        )}
      >
        {visible.map((c) => (
          <StaggerItem key={c.slug} className="min-w-0 [&>article]:h-full">
            <StatusCard {...c} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
