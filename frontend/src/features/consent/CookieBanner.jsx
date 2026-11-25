// Modal olmayan çerez bandı (sayfa kullanılabilir kalır).
// "Kabul et" ve "Reddet" eşit ağırlıkta. Tercihler diyaloğu lazy (Dialog ana pakete girmez).
import { lazy, Suspense } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button.jsx';
import { useSite } from '@/features/site/useSite.js';
import { useConsent } from './consentStore.js';

const PreferencesDialog = lazy(() => import('./PreferencesDialog.jsx'));

export function CookieBanner() {
  const { data } = useSite();
  const version = data?.legal?.cookiePolicyVersion ?? 1;
  const show = useConsent((s) => Boolean(data) && s.needsDecision(version));
  const decide = useConsent((s) => s.decide);
  const preferencesOpen = useConsent((s) => s.preferencesOpen);
  const openPreferences = useConsent((s) => s.openPreferences);

  return (
    <>
      {show && (
        <section
          aria-label="Çerez tercihi"
          className="surface-chrome fixed inset-x-3 bottom-24 z-[var(--z-banner)] mx-auto max-w-[560px] rounded-[var(--radius-lg)] border p-4 shadow-lg sm:inset-x-auto sm:left-4 sm:mx-0 sm:p-5"
        >
          <p className="text-sm text-pretty">
            Zorunlu çerezler her zaman açık. İzin verirsen siteyi geliştirmek için{' '}
            <strong>anonim ziyaret istatistikleri</strong> tutarız; kişisel veri saklanmaz.{' '}
            <Link to="/cerez-politikasi" className="underline underline-offset-4">
              Çerez politikası
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => decide(false, version)}>
              Reddet
            </Button>
            <Button variant="secondary" onClick={() => decide(true, version)}>
              Kabul et
            </Button>
            <Button variant="ghost" className="ml-auto" onClick={openPreferences}>
              Tercihler
            </Button>
          </div>
        </section>
      )}
      {preferencesOpen && (
        <Suspense fallback={null}>
          <PreferencesDialog version={version} />
        </Suspense>
      )}
    </>
  );
}
