// FR-PUB-02 — tüm public sayfalar: sahne + navbar + içerik + footer. Welcome burada (public'e özel);
// <audio> ise router dışında (AppRoutes) olduğu için sayfa ve admin geçişlerinde kesilmez.
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { CursorManager } from '@/features/scene/CursorManager.jsx';
import { SceneLayer } from '@/features/scene/SceneLayer.jsx';
import { FallingLayer } from '@/features/scene/FallingLayer.jsx';
import { WelcomeOverlay } from '@/features/welcome/WelcomeOverlay.jsx';
import { useWelcome } from '@/features/welcome/welcomeStore.js';
import { Footer } from './Footer.jsx';
import { Navbar } from './Navbar.jsx';
import { CookieBanner } from '@/features/consent/CookieBanner.jsx';
import { PageTransition } from '@/features/motion/Reveal.jsx';
import { usePageViews } from '@/features/consent/useAnalytics.js';

/** FR-CKE-06 — izin varsa her public route değişiminde PAGE_VIEW. */
function PageViews() {
  usePageViews();
  return null;
}

/** Sayfa değişince başa, `#hash` varsa o bölüme kaydırır (ör. /#projeler). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.();
      return;
    }
    window.scrollTo?.(0, 0);
  }, [pathname, hash]);
  return null;
}

export function PublicLayout() {
  const { pathname } = useLocation();
  // FR-WEL-07: karşılama ekranı açıkken (bağlanma + tıklama beklemesi) yalnızca sahne (arka plan) görünür.
  const veiled = useWelcome((s) => !s.entered);
  return (
    <div className="relative isolate flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-[var(--z-toast)] rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        İçeriğe geç
      </a>
      <ScrollManager />
      <PageViews />
      <SceneLayer />
      <CursorManager />
      <Navbar />
      <div
        inert={veiled}
        className={
          'flex flex-1 flex-col transition-opacity duration-700 ' +
          (veiled ? 'pointer-events-none opacity-0' : 'opacity-100')
        }
      >
        <FallingLayer />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <ErrorBoundary>
            <PageTransition routeKey={pathname}>
              <Outlet />
            </PageTransition>
          </ErrorBoundary>
        </main>
        <Footer />
        <ErrorBoundary fallback={null}>
          <CookieBanner />
        </ErrorBoundary>
      </div>
      <WelcomeOverlay />
    </div>
  );
}
