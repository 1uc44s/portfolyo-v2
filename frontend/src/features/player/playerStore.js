// FR-PLY-01..05, FR-WEL-04 — tek global <audio> için durum, komutlar ve kalıcı tercihler.
// <audio> GlobalAudio'da; PlayerBar ve Media Session yalnızca bu store üzerinden komut verir.
import { create } from 'zustand';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // depolama kapalı: tercih yalnızca bu oturumda geçerli
  }
};

export const DEFAULT_VOLUME = 0.6;
export const SEEK_STEP = 5;

const storedVolume = () => {
  const v = Number.parseFloat(read('playerVolume'));
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOLUME;
};

const finite = (n) => (Number.isFinite(n) ? n : 0);

export const usePlayer = create((set, get) => ({
  audio: null,
  volume: storedVolume(),
  muted: read('playerMuted') === 'true',
  playing: false,
  error: false,
  currentTime: 0,
  duration: 0,

  attach: (audio) => {
    if (audio) {
      audio.volume = get().volume;
      audio.muted = get().muted;
    }
    set({ audio, ...(audio ? {} : { playing: false, currentTime: 0, duration: 0 }) });
  },

  /** Welcome etkileşimi içinde çağrılır (autoplay politikası). Kullanıcı durdurduysa başlatmaz. */
  startFromGesture: () => {
    const { audio } = get();
    if (!audio || read('playerPaused') === 'true') return;
    audio.volume = get().volume;
    audio.play().catch(() => {
      // NotAllowedError vb. sessizce yutulur (FR-WEL-05).
    });
  },

  play: () => {
    const { audio } = get();
    if (!audio) return;
    write('playerPaused', false);
    audio.play().catch(() => {});
  },
  pause: () => {
    const { audio } = get();
    if (!audio) return;
    write('playerPaused', true);
    audio.pause();
  },
  toggle: () => {
    const { audio, play, pause } = get();
    if (!audio) return;
    if (audio.paused) play();
    else pause();
  },

  seekTo: (seconds) => {
    const { audio } = get();
    if (!audio) return;
    const max = finite(audio.duration) || get().duration;
    const t = Math.max(0, max > 0 ? Math.min(max, seconds) : seconds);
    audio.currentTime = t;
    set({ currentTime: t });
  },
  seekBy: (delta) => get().seekTo(finite(get().audio?.currentTime) + delta),

  setVolume: (volume) => {
    const v = Math.min(1, Math.max(0, volume));
    const { audio, muted } = get();
    const unmute = muted && v > 0;
    if (audio) {
      audio.volume = v;
      if (unmute) audio.muted = false;
    }
    write('playerVolume', v);
    if (unmute) write('playerMuted', false);
    set({ volume: v, ...(unmute && { muted: false }) });
  },
  toggleMute: () => {
    const { audio, muted, volume } = get();
    const next = !muted;
    // Ses 0'dayken sesi açmak anlamsız: varsayılan seviyeye dön.
    if (!next && volume === 0) get().setVolume(DEFAULT_VOLUME);
    if (audio) audio.muted = next;
    write('playerMuted', next);
    set({ muted: next });
  },

  /** `error` sonrası "Tekrar dene": kaynağı yeniden yükler ve oynatmayı dener. */
  retry: () => {
    const { audio } = get();
    if (!audio) return;
    set({ error: false });
    audio.load();
    if (read('playerPaused') !== 'true') audio.play().catch(() => {});
  },

  setPlaying: (playing) => set({ playing }),
  setError: (error) => set({ error }),
  syncTime: (currentTime) => set({ currentTime: finite(currentTime) }),
  syncDuration: (duration) => set({ duration: finite(duration) }),
}));
