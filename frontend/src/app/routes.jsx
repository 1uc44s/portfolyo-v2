// ROUTES.md §2 — public route'lar; admin ayrı (lazy) chunk, public bundle'a girmez (NFR-PERF-01).
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { HomePage } from '@/pages/HomePage.jsx';
import { NotFoundPage } from '@/pages/NotFoundPage.jsx';
import { PublicLayout } from '@/features/layout/PublicLayout.jsx';
import { GlobalAudio } from '@/features/player/GlobalAudio.jsx';
import { FullPageSkeleton } from '@/components/common/FullPageSkeleton.jsx';

const AdminApp = lazy(() => import('@/admin/AdminApp.jsx'));
// İndirme sayfaları ayrı chunk: Dialog, galeri ve lightbox ana public paketine girmez.
const DownloadPage = lazy(() => import('@/pages/DownloadPage.jsx'));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage.jsx'));
const LegalPage = lazy(() => import('@/pages/LegalPage.jsx'));

const lazyPage = (page) => (
  <Suspense fallback={<div className="min-h-[60dvh]" aria-busy="true" />}>{page}</Suspense>
);
const download = (kind) => (
  <Suspense fallback={<div className="min-h-[60dvh]" aria-busy="true" />}>
    <DownloadPage kind={kind} />
  </Suspense>
);
// Yalnızca geliştirme build'inde; prod paketinden ağaç sallama ile düşer.
const StyleguidePage = import.meta.env.DEV
  ? lazy(() => import('@/pages/dev/StyleguidePage.jsx'))
  : null;

export function AppRoutes() {
  return (
    <>
      <GlobalAudio />
      <PublicAndAdminRoutes />
    </>
  );
}

function PublicAndAdminRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/wallpapers" element={download('wallpapers')} />
        <Route path="/pfps" element={download('pfps')} />
        <Route path="/projects/:slug" element={lazyPage(<ProjectDetailPage />)} />
        <Route path="/kvkk" element={lazyPage(<LegalPage key="kvkk" docKey="kvkk-notice" />)} />
        <Route
          path="/cerez-politikasi"
          element={lazyPage(<LegalPage key="cookie" docKey="cookie-policy" />)}
        />
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<FullPageSkeleton label="Yönetim paneli yükleniyor" />}>
            <AdminApp />
          </Suspense>
        }
      />
      {StyleguidePage && (
        <Route
          path="/dev/styleguide"
          element={
            <Suspense fallback={<FullPageSkeleton label="Stil rehberi yükleniyor" />}>
              <StyleguidePage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
