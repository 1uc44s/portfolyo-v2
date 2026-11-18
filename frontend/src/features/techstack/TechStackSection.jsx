// FR-PUB-04 — Tech Stack bölümü. Yayındaki bölüm yoksa ana sayfada Tech Stack ile ilgili hiçbir şey
// gösterilmez (2026-11-17 kullanıcı kararı; eski "Coming soon" yer tutucusu kaldırıldı). Yayındaysa (F21)
// halka düzeni lazy chunk'tan yüklenir.
import { lazy, Suspense } from 'react';

const TechStackLive = lazy(() => import('./TechStackLive.jsx'));

export function TechStackSection({ published = false }) {
  if (!published) return null;
  return (
    <Suspense fallback={<div aria-hidden="true" className="min-h-[60vw] sm:min-h-[600px]" />}>
      <TechStackLive />
    </Suspense>
  );
}
