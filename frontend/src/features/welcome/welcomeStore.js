// FR-WEL-01, FR-NAV-05 — karşılama durumu: navbar giriş animasyonu ekran kapanınca başlar.
// `entered`: karşılama geçildi (ya da bu sekmede daha önce geçilmişti).
// Karşılama açıkken (`entered` false) site bileşenleri gizlenir, yalnızca arka plan görünür (FR-WEL-07).
import { create } from 'zustand';

export const WELCOME_KEY = 'welcomed';

export const welcomedBefore = () => {
  try {
    return sessionStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
};

export const useWelcome = create((set) => ({
  entered: welcomedBefore(),
  setEntered: (entered) => set({ entered }),
  markEntered: () => {
    try {
      sessionStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // Depolama kapalı: yalnızca bu sayfa ömrü için geçerli.
    }
    set({ entered: true });
  },
}));
