// FR-PLY-01 — uygulamada TEK <audio>; router'ın dışında, sayfa geçişlerinde yeniden oluşmaz.
// Olaylar store'a yansır (PlayerBar, Media Session); komutlar store üzerinden gelir.
import { useCallback } from 'react';
import { useSite } from '@/features/site/useSite.js';
import { useMediaSession } from './mediaSession.js';
import { usePlayer } from './playerStore.js';

export function GlobalAudio() {
  const { data } = useSite();
  const music = data?.today?.music ?? null;
  const attach = usePlayer((s) => s.attach);
  const setPlaying = usePlayer((s) => s.setPlaying);
  const setError = usePlayer((s) => s.setError);
  const syncTime = usePlayer((s) => s.syncTime);
  const syncDuration = usePlayer((s) => s.syncDuration);
  const ref = useCallback((node) => attach(node), [attach]);
  useMediaSession(music);
  if (!music) return null;

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- arka plan müziği; konuşma içermez
    <audio
      ref={ref}
      src={music.audioUrl}
      loop
      preload="metadata"
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => {
        setPlaying(false);
        setError(true);
      }}
      onCanPlay={() => setError(false)}
      onTimeUpdate={(e) => syncTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => syncDuration(e.currentTarget.duration)}
      onDurationChange={(e) => syncDuration(e.currentTarget.duration)}
    />
  );
}
