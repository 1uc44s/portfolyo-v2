// Ana sayfa (Şartname §4 sırası): Hero → Durumlar → Tech Stack (Coming soon; içerik F21) → Projeler → Hakkımda →
// Linkler → İletişim. İçeriği olmayan bölüm DOM'a eklenmez (FR-PUB-03); İletişim her zaman var.
// Oynatıcı PublicLayout'ta (tüm public sayfalarda) yüzen şerittir.
import { lazy, Suspense } from 'react';
import { m } from 'motion/react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary.jsx';
import { Hero, HeroSkeleton } from '@/features/hero/Hero.jsx';
import { LinksSection } from '@/features/links/LinksSection.jsx';
import { ProjectsSection } from '@/features/projects/ProjectsSection.jsx';
import { StatusSection } from '@/features/status/StatusCards.jsx';
import { TechStackSection } from '@/features/techstack/TechStackSection.jsx';
import { Reveal } from '@/features/motion/Reveal.jsx';
import { PlayerBar } from '@/features/player/PlayerBar.jsx';
import { useSite } from '@/features/site/useSite.js';
import { useAnimatedTitle } from '@/features/site/useAnimatedTitle.js';

// Markdown motoru yalnızca Hakkımda doluysa yüklenir.
const AboutSection = lazy(() => import('@/features/about/AboutSection.jsx'));
// Form kütüphaneleri (react-hook-form, zod çözücü) ve Turnstile yalnızca bu chunk'ta.
const ContactSection = lazy(() => import('@/features/contact/ContactSection.jsx'));

export function HomePage() {
  const { data, isPending } = useSite();
  // FR-TAB-01 — sekme başlığı navbar başlığından harf harf + rastgele emoji.
  useAnimatedTitle(data?.navbarTitle);

  return (
    <>
      <section
        aria-label="Tanıtım"
        className="mx-auto flex min-h-[70dvh] max-w-[1200px] flex-col items-center justify-center px-4 py-16"
      >
        {isPending ? (
          <HeroSkeleton />
        ) : (
          <ErrorBoundary>
            <m.div
              className="max-w-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <Hero
                hero={data?.hero && { ...data.hero, overlayUrl: data.today?.nameOverlay?.url }}
              />
            </m.div>
          </ErrorBoundary>
        )}
      </section>
      {data?.integrations && (
        <ErrorBoundary>
          <Reveal>
            <StatusSection integrations={data.integrations} />
          </Reveal>
        </ErrorBoundary>
      )}
      {/* Müzik oynatıcı: durumların hemen altında, sayfa akışında (sabit alt şerit değil). */}
      <ErrorBoundary fallback={null}>
        <Reveal className="mx-auto w-full max-w-[1200px] px-4 pb-12 sm:px-6">
          <PlayerBar />
        </Reveal>
      </ErrorBoundary>
      {data && (
        <Reveal>
          <TechStackSection published={data.techStack?.published} />
        </Reveal>
      )}
      {data?.sections?.projects && (
        <ErrorBoundary>
          <Reveal>
            <ProjectsSection />
          </Reveal>
        </ErrorBoundary>
      )}
      {data?.sections?.about && (
        <ErrorBoundary>
          <Suspense fallback={<div aria-hidden="true" className="min-h-48" />}>
            <Reveal>
              <AboutSection about={data.about} />
            </Reveal>
          </Suspense>
        </ErrorBoundary>
      )}
      {data?.sections?.links && (
        <ErrorBoundary>
          <Reveal>
            <LinksSection />
          </Reveal>
        </ErrorBoundary>
      )}
      {/* Her zaman mount: site yüklenirken de yer ayrılır, footer kaymaz (CLS — F20 Lighthouse). */}
      <ErrorBoundary>
        <Suspense fallback={<div aria-hidden="true" className="min-h-[900px] sm:min-h-[640px]" />}>
          <Reveal>
            <ContactSection captcha={data?.captcha} />
          </Reveal>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
