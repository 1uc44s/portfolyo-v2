// Uygulama genel sağlayıcıları: sorgu önbelleği ve hareket ayarı.
// Tooltip ve Toaster yalnızca admin chunk'ında (AdminApp) — public bundle bütçesi (PRD §5).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'motion/react';
import { usePrefs } from '@/lib/prefs.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

// F19 — özellikler async: ~70 KB (ham) ana paketten çıkar; yüklenene kadar m.* öğeleri statik görünür.
const loadFeatures = () => import('./motionFeatures.js').then((mod) => mod.default);

export function AppProviders({ children }) {
  const effects = usePrefs((s) => s.effects);
  return (
    <QueryClientProvider client={queryClient}>
      {/* LazyMotion: domAnimation özellikleri ayrı chunk'ta, async yüklenir (public bundle bütçesi). */}
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion={effects === 'low' ? 'always' : 'user'}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}
