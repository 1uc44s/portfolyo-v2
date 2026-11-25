// PlayerBar — yüzen cam şerit; <audio> GlobalAudio'da, bu yalnızca arayüz.
// Masaüstü tek satır (72 px): kapak+bilgi | −5 / oynat / +5 | süre + ilerleme | ses.
// Mobil iki satır: ilerleme ve süreler ikinci satırda (320 px'te hiçbir kontrol kaybolmaz).
import { Music, Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useSite } from '@/features/site/useSite.js';
import { cn } from '@/lib/utils';
import { SEEK_STEP, usePlayer } from './playerStore.js';

export const formatTime = (seconds) => {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Durumların altında, sayfa akışı içinde; dikdörtgen kart (2026-11-16: ince sabit şerit kaldırıldı).
const SHELL =
  'surface-chrome mx-auto w-full max-w-[600px] overflow-hidden rounded-[var(--radius-xl)] border';

const iconButton =
  'text-foreground/85 hover:text-foreground hover:bg-accent focus-visible:ring-ring/60 grid size-9 shrink-0 place-items-center rounded-full transition-colors outline-none focus-visible:ring-2 disabled:opacity-40';

function Equalizer({ on }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 flex h-5 items-end justify-center gap-[3px] rounded-b-[var(--radius-md)] bg-gradient-to-t from-black/60 to-transparent pb-1"
    >
      {[0, 0.2, 0.4].map((delay) => (
        <span
          key={delay}
          data-on={on}
          className="eq-bar h-3 w-[3px] rounded-full bg-white"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  );
}

function SeekButton({ direction, onClick, disabled }) {
  const Icon = direction < 0 ? RotateCcw : RotateCw;
  return (
    <button
      type="button"
      className={cn(iconButton, 'relative')}
      onClick={onClick}
      disabled={disabled}
      aria-label={direction < 0 ? '5 saniye geri sar' : '5 saniye ileri sar'}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
      <span aria-hidden="true" className="absolute text-[8px] leading-none font-semibold">
        5
      </span>
    </button>
  );
}

function Progress({ current, duration, onSeek, onStep, className }) {
  const max = duration > 0 ? duration : 0;
  const fill = max > 0 ? `${(Math.min(current, max) / max) * 100}%` : '0%';
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span className="type-meta text-muted-foreground w-10 shrink-0 text-right tabular-nums">
        {formatTime(current)}
      </span>
      <input
        type="range"
        aria-label="İlerleme"
        aria-valuetext={`${formatTime(current)} / ${formatTime(max)}`}
        min={0}
        max={max || 1}
        step="any"
        value={Math.min(current, max || 1)}
        disabled={max === 0}
        onChange={(e) => onSeek(Number(e.currentTarget.value))}
        onKeyDown={(e) => {
          const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
          if (!delta) return;
          e.preventDefault();
          onStep(delta * SEEK_STEP);
        }}
        className="player-range min-w-0 flex-1 disabled:cursor-default"
        style={{ '--fill': fill }}
      />
      <span className="type-meta text-muted-foreground w-10 shrink-0 tabular-nums">
        {formatTime(max)}
      </span>
    </div>
  );
}

function Volume() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;
  return (
    <div className="hidden items-center gap-1.5 md:flex">
      <button
        type="button"
        className={iconButton}
        onClick={toggleMute}
        aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
        aria-pressed={muted}
      >
        <Icon aria-hidden="true" className="size-[18px]" />
      </button>
      <input
        type="range"
        aria-label="Ses seviyesi"
        aria-valuetext={`%${Math.round(effective * 100)}`}
        min={0}
        max={1}
        step={0.05}
        value={effective}
        onChange={(e) => setVolume(Number(e.currentTarget.value))}
        className="player-range w-24"
        style={{ '--fill': `${effective * 100}%` }}
      />
    </div>
  );
}

export function PlayerBar() {
  const { data, isPending } = useSite();
  const music = data?.today?.music;
  const playing = usePlayer((s) => s.playing);
  const error = usePlayer((s) => s.error);
  const current = usePlayer((s) => s.currentTime);
  const liveDuration = usePlayer((s) => s.duration);
  const toggle = usePlayer((s) => s.toggle);
  const seekBy = usePlayer((s) => s.seekBy);
  const seekTo = usePlayer((s) => s.seekTo);
  const retry = usePlayer((s) => s.retry);

  if (isPending) {
    return (
      <div aria-hidden="true" data-testid="player-skeleton" className={SHELL}>
        <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
          <div className="bg-muted size-24 shrink-0 animate-pulse rounded-[var(--radius-lg)] sm:size-32" />
          <div className="flex flex-1 flex-col justify-between gap-3 py-1">
            <div className="grid gap-2">
              <div className="bg-muted h-4 w-40 max-w-full animate-pulse rounded-full" />
              <div className="bg-muted h-3 w-24 animate-pulse rounded-full" />
            </div>
            <div className="bg-muted h-12 w-44 animate-pulse rounded-full sm:h-14" />
            <div className="bg-muted h-2 w-full animate-pulse rounded-full" />
          </div>
        </div>
      </div>
    );
  }
  if (!music) return null;

  // metadata gelene kadar API süresi.
  const duration = liveDuration > 0 ? liveDuration : (music.durationMs ?? 0) / 1000;

  return (
    <section aria-label="Müzik oynatıcı" className={SHELL}>
      <div className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        {/* Büyük kapak (kart yüksekliğince) */}
        <div className="relative size-24 shrink-0 self-stretch overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-3)] sm:size-32">
          {music.coverUrl ? (
            <img src={music.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center">
              <Music aria-hidden="true" className="text-muted-foreground size-7" />
            </span>
          )}
          {playing && !error && <Equalizer on />}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold sm:text-lg" title={music.title}>
              {music.title}
            </p>
            {music.artist && (
              <p className="text-muted-foreground mt-0.5 truncate text-sm" title={music.artist}>
                {music.artist}
              </p>
            )}
          </div>

          {error ? (
            <div role="alert" className="flex items-center gap-3">
              <p className="text-danger text-sm">Müzik yüklenemedi</p>
              <button
                type="button"
                onClick={retry}
                className="hover:bg-accent focus-visible:ring-ring/60 rounded-full border px-3 py-1.5 text-sm outline-none focus-visible:ring-2"
              >
                Tekrar dene
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <SeekButton direction={-1} onClick={() => seekBy(-SEEK_STEP)} />
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? 'Duraklat' : 'Oynat'}
                    className="bg-primary text-primary-foreground focus-visible:ring-ring/60 hover:bg-primary/90 grid size-12 place-items-center rounded-full shadow-[0_0_18px_var(--accent-glow)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:size-14"
                  >
                    {playing ? (
                      <Pause aria-hidden="true" className="size-6 fill-current" />
                    ) : (
                      <Play aria-hidden="true" className="ml-0.5 size-6 fill-current" />
                    )}
                  </button>
                  <SeekButton direction={1} onClick={() => seekBy(SEEK_STEP)} />
                </div>
                <Volume />
              </div>
              <Progress current={current} duration={duration} onSeek={seekTo} onStep={seekBy} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
