// izin varsa tracker'ı yükler ve olay gönderir; yoksa hiçbir şey yapmaz.
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useSite } from '@/features/site/useSite.js';
import { useConsent } from './consentStore.js';

/** İzin kontrolü + dinamik import. */
export function useAnalyticsAllowed() {
  const { data } = useSite();
  const version = data?.legal?.cookiePolicyVersion;
  return useConsent((s) => Boolean(data) && s.analyticsAllowed(version));
}

const loadTracker = () => import('./tracker.js');

/** PublicLayout: her public route değişiminde PAGE_VIEW. */
export function usePageViews() {
  const { pathname } = useLocation();
  const allowed = useAnalyticsAllowed();
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    loadTracker().then((t) => {
      if (!cancelled) t.trackPage(pathname);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, pathname]);
}

/** Proje detayı: PROJECT_VIEW (sunucu ziyaretçi + gün başına bir kez sayar). */
export function useProjectView(slug) {
  const { pathname } = useLocation();
  const allowed = useAnalyticsAllowed();
  useEffect(() => {
    if (!allowed || !slug) return;
    loadTracker().then((t) => t.trackProject(slug, pathname));
  }, [allowed, slug, pathname]);
}
