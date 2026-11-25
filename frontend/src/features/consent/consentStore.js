// çerez izni. `necessary` her zaman açık; `analytics` varsayılan kapalı.
// localStorage.consent = { version, analytics, decidedAt, consentId? }. Okunamazsa (gizli mod)
// her oturumda sorulur ve analitik kapalı kalır. Sunucu kaydı başarısız olsa da tercih geçerlidir.
import { create } from 'zustand';
import { api } from '@/lib/api/client.js';

const KEY = 'consent';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value?.version !== 'number' || typeof value?.analytics !== 'boolean') return null;
    return value;
  } catch {
    return null;
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Depolama yok: tercih yalnızca bu oturumda geçerli.
  }
}

/** Sunucuya anonim kanıt; hata akışı bozmaz. */
async function report(value) {
  try {
    const { data } = await api.post('/public/consent', {
      ...(value.consentId ? { consentId: value.consentId } : {}),
      version: value.version,
      analytics: value.analytics,
    });
    return data?.data?.consentId ?? null;
  } catch {
    return null;
  }
}

export const useConsent = create((set, get) => ({
  decision: read(),
  preferencesOpen: false,

  /** Politika sürümüne göre karar gerekiyor mu. */
  needsDecision: (policyVersion) => {
    const d = get().decision;
    return !d || d.version < (policyVersion ?? 1);
  },

  /** Analitik izinli mi (karar mevcut sürüm için verilmiş olmalı). */
  analyticsAllowed: (policyVersion) => {
    const d = get().decision;
    return Boolean(d?.analytics && d.version >= (policyVersion ?? 1));
  },

  decide: async (analytics, policyVersion = 1) => {
    const prev = get().decision;
    const value = {
      version: policyVersion,
      analytics,
      decidedAt: new Date().toISOString(),
      ...(prev?.consentId ? { consentId: prev.consentId } : {}),
    };
    write(value);
    set({ decision: value, preferencesOpen: false });
    const consentId = await report(value);
    if (consentId && consentId !== value.consentId) {
      const withId = { ...get().decision, consentId };
      write(withId);
      set({ decision: withId });
    }
  },

  openPreferences: () => set({ preferencesOpen: true }),
  closePreferences: () => set({ preferencesOpen: false }),
}));

/** Testler için. */
export const resetConsentStore = () =>
  useConsent.setState({ decision: read(), preferencesOpen: false });
