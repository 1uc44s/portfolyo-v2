// ROUTES.md §2.2 — admin uygulaması (lazy chunk). Açılışta sessiz refresh ile oturum geri yüklenir.
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { FullPageSkeleton } from '@/components/common/FullPageSkeleton.jsx';
import { Toaster } from '@/components/ui/sonner.jsx';
import { TooltipProvider } from '@/components/ui/tooltip.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { refreshSession } from '@/lib/auth/session.js';
import { ChangePasswordPage } from './auth/ChangePasswordPage.jsx';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage.jsx';
import { LoginPage } from './auth/LoginPage.jsx';
import { ResetPasswordPage } from './auth/ResetPasswordPage.jsx';
import { TwoFactorPage } from './auth/TwoFactorPage.jsx';
import { AdminLayout } from './components/AdminShell.jsx';
import { ModulePlaceholder } from './components/PageHeader.jsx';
import { NAV_ITEMS } from './lib/navigation.js';

// F19 bundle — her modül sayfası kendi chunk'ında; panel kabuğu ve giriş ekranları ilk yüklemede.
const page = (load, name) => lazy(() => load().then((mod) => ({ default: mod[name] })));
const AccountPage = page(() => import('./pages/account/AccountPage.jsx'), 'AccountPage');
const DashboardPage = page(() => import('./pages/DashboardPage.jsx'), 'DashboardPage');
const HeroPage = page(() => import('./pages/HeroPage.jsx'), 'HeroPage');
const MediaPage = page(() => import('./pages/media/MediaPage.jsx'), 'MediaPage');
const CategoriesPage = page(
  () => import('./pages/categories/CategoriesPage.jsx'),
  'CategoriesPage',
);
const LinksPage = page(() => import('./pages/links/LinksPage.jsx'), 'LinksPage');
const MessagesPage = page(() => import('./pages/messages/MessagesPage.jsx'), 'MessagesPage');
const IntegrationsPage = page(
  () => import('./pages/integrations/IntegrationsPage.jsx'),
  'IntegrationsPage',
);
const SystemPage = page(() => import('./pages/system/SystemPage.jsx'), 'SystemPage');
const TechStackPage = page(() => import('./pages/techstack/TechStackPage.jsx'), 'TechStackPage');
const ProjectEditorPage = page(
  () => import('./pages/projects/ProjectEditorPage.jsx'),
  'ProjectEditorPage',
);
const ProjectsPage = page(() => import('./pages/projects/ProjectsPage.jsx'), 'ProjectsPage');
const SiteSettingsPage = page(() => import('./pages/SiteSettingsPage.jsx'), 'SiteSettingsPage');

/** Sayfa chunk'ı yüklenirken içerik alanında hafif iskelet. */
const lazyPage = (el) => (
  <Suspense fallback={<div className="min-h-[60dvh]" aria-busy="true" />}>{el}</Suspense>
);

/** FR-AUTH-09 + ROUTES §2.2 — oturum yoksa girişe, şifre değişimi zorunluysa oraya. */
function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status);
  const admin = useAuthStore((s) => s.admin);
  const location = useLocation();

  if (status === 'unknown') return <FullPageSkeleton label="Oturum kontrol ediliyor" />;
  if (status !== 'authenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  if (admin?.mustChangePassword) return <Navigate to="/admin/change-password" replace />;
  return children;
}

/** Giriş yapmış kullanıcı giriş ekranlarına dönerse panele yönlendirilir. */
function GuestOnly({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'unknown') return <FullPageSkeleton label="Oturum kontrol ediliyor" />;
  if (status === 'authenticated') return <Navigate to="/admin" replace />;
  return children;
}

const placeholders = NAV_ITEMS.filter((item) => item.phase && item.to !== '/admin');

export default function AdminApp() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'unknown') refreshSession().catch(() => {});
  }, [status]);

  return (
    <TooltipProvider delayDuration={300}>
      <AdminRoutes />
      <Toaster />
    </TooltipProvider>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="login/2fa"
        element={
          <GuestOnly>
            <TwoFactorPage />
          </GuestOnly>
        }
      />
      <Route
        path="forgot-password"
        element={
          <GuestOnly>
            <ForgotPasswordPage />
          </GuestOnly>
        }
      />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="change-password" element={<ChangePasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={lazyPage(<DashboardPage />)} />
        <Route path="account" element={lazyPage(<AccountPage />)} />
        <Route path="settings" element={lazyPage(<SiteSettingsPage />)} />
        <Route path="hero" element={lazyPage(<HeroPage />)} />
        <Route path="media" element={<Navigate to="/admin/media/backgrounds" replace />} />
        <Route path="media/:tab" element={lazyPage(<MediaPage />)} />
        <Route path="projects" element={lazyPage(<ProjectsPage />)} />
        <Route path="projects/:id" element={lazyPage(<ProjectEditorPage />)} />
        <Route path="categories" element={lazyPage(<CategoriesPage />)} />
        <Route path="links" element={lazyPage(<LinksPage />)} />
        <Route path="messages" element={lazyPage(<MessagesPage />)} />
        <Route path="status" element={lazyPage(<IntegrationsPage />)} />
        <Route path="system" element={lazyPage(<SystemPage />)} />
        <Route path="tech-stack" element={lazyPage(<TechStackPage />)} />
        {placeholders.map((item) => (
          <Route
            key={item.to}
            path={`${item.to.replace('/admin/', '')}/*`}
            element={<ModulePlaceholder item={item} />}
          />
        ))}
        <Route
          path="*"
          element={<ModulePlaceholder item={{ label: 'Sayfa bulunamadı', phase: null }} />}
        />
      </Route>
    </Routes>
  );
}
