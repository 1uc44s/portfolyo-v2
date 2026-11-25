// görünüm tercihleri. index.html'deki init script ilk değeri zaten
// <html data-*> üzerine yazdı; store oradan başlar, değişiklikleri hem DOM'a hem localStorage'a yazar.
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
    localStorage.setItem(key, value);
  } catch {
    // Gizli mod / engelli depolama: tercih yalnızca bu oturumda geçerli kalır.
  }
};

const root = () => document.documentElement;

const apply = (key, value) => {
  root().dataset[key] = value;
};

export const usePrefs = create((set, get) => ({
  theme: root().dataset.theme === 'light' ? 'light' : 'dark',
  surface: root().dataset.surface === 'classic' ? 'classic' : 'glass',
  effects: root().dataset.effects === 'low' ? 'low' : 'full',

  setTheme: (theme) => {
    apply('theme', theme);
    write('theme', theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  setSurface: (surface) => {
    apply('surface', surface);
    write('surface', surface);
    set({ surface });
  },
  toggleSurface: () => get().setSurface(get().surface === 'glass' ? 'classic' : 'glass'),

  setEffects: (effects) => {
    apply('effects', effects);
    write('effects', effects);
    set({ effects });
  },
  toggleEffects: () => get().setEffects(get().effects === 'full' ? 'low' : 'full'),
}));

// Kullanıcı tema seçmediyse sistem tercihini canlı takip et.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
    if (read('theme')) return;
    const theme = event.matches ? 'light' : 'dark';
    apply('theme', theme);
    usePrefs.setState({ theme });
  });
}
