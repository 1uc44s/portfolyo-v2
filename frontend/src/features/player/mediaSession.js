// işletim sistemi medya kontrolleri (kilit ekranı, klavye medya tuşları).
// Desteklenmeyen tarayıcıda hiçbir şey yapmaz.
import { useEffect } from 'react';
import { SEEK_STEP, usePlayer } from './playerStore.js';

const session = () =>
  typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;

const safe = (fn) => {
  try {
    fn();
  } catch {
    // Bazı tarayıcılar belirli eylemleri desteklemez (NotSupportedError).
  }
};

export function useMediaSession(music) {
  useEffect(() => {
    const ms = session();
    if (!ms || !music) return undefined;

    if (typeof window.MediaMetadata === 'function') {
      ms.metadata = new window.MediaMetadata({
        title: music.title,
        artist: music.artist ?? '',
        artwork: music.coverUrl ? [{ src: music.coverUrl, sizes: '512x512' }] : [],
      });
    }

    const player = () => usePlayer.getState();
    const handlers = {
      play: () => player().play(),
      pause: () => player().pause(),
      seekbackward: (d) => player().seekBy(-(d?.seekOffset || SEEK_STEP)),
      seekforward: (d) => player().seekBy(d?.seekOffset || SEEK_STEP),
      seekto: (d) => Number.isFinite(d?.seekTime) && player().seekTo(d.seekTime),
    };
    Object.entries(handlers).forEach(([action, handler]) =>
      safe(() => ms.setActionHandler(action, handler)),
    );

    // Konum bilgisi: saniyede en fazla bir kez.
    let last = -1;
    const unsubscribe = usePlayer.subscribe((s) => {
      ms.playbackState = s.playing ? 'playing' : 'paused';
      const second = Math.floor(s.currentTime);
      if (second === last || !(s.duration > 0)) return;
      last = second;
      safe(() =>
        ms.setPositionState({
          duration: s.duration,
          position: Math.min(s.currentTime, s.duration),
          playbackRate: 1,
        }),
      );
    });

    return () => {
      unsubscribe();
      Object.keys(handlers).forEach((action) => safe(() => ms.setActionHandler(action, null)));
      ms.metadata = null;
    };
  }, [music]);
}
