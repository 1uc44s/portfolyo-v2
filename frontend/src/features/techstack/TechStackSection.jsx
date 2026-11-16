// FR-PUB-04, CMS.md §7 — Tech Stack yer tutucusu: yalnızca başlık + "Coming soon" (kart/ikon/logo yok).
// Yayındaysa (F21) halka düzeni lazy chunk'tan yüklenir.
import { lazy, Suspense } from 'react';

const TechStackLive = lazy(() => import('./TechStackLive.jsx'));
export const TECH_STACK_PLACEHOLDER = 'Coming soon';

export function TechStackSection({ published = false }) {
  if (published) {
    return (
      <Suspense fallback={<div aria-hidden="true" className="min-h-[60vw] sm:min-h-[600px]" />}>
        <TechStackLive />
      </Suspense>
    );
  }
  return (
    <section
      id="tech-stack"
      aria-labelledby="tech-stack-title"
      className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-12 text-center sm:px-6"
    >
      <h2 id="tech-stack-title" className="type-h1">
        Tech Stack
      </h2>
      <p lang="en" className="text-muted-foreground type-meta mt-3 tracking-[0.08em]">
        {TECH_STACK_PLACEHOLDER}
      </p>
    </section>
  );
}
