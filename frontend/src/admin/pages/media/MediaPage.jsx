// Medya Yönetimi: /admin/media/:tab (varsayılan backgrounds).
// Sekmeler bağlantıdır (adres çubuğu ve geri tuşu çalışır); aktif sekme aria-current ile işaretlenir.
import { useEffect } from 'react';
import { NavLink, Navigate, useParams } from 'react-router';
import { hasPermission } from '@my-portfolyo/shared';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { cn } from '@/lib/utils';
import { useBlobUrlCleanup } from '../../lib/useAuthedMedia.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { ContentTab } from './ContentTab.jsx';
import { LibraryTab, StorageSummary } from './LibraryTab.jsx';
import { CONTENT_TABS, LIBRARY_TABS } from './mediaConfig.js';

const ALL_TABS = [...CONTENT_TABS, ...LIBRARY_TABS];

function TabNav() {
  return (
    <nav aria-label="Medya türleri" className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-1 px-1">
        {ALL_TABS.map((tab) => (
          <li key={tab.type}>
            <NavLink
              to={`/admin/media/${tab.type}`}
              className={({ isActive }) =>
                cn(
                  'focus-visible:ring-ring/50 inline-flex min-h-10 items-center rounded-full px-4 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MediaPage() {
  const { tab: tabParam } = useParams();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'media:write');
  const tab = ALL_TABS.find((t) => t.type === tabParam);
  useBlobUrlCleanup();

  useEffect(() => {
    document.title = `${tab?.label ?? 'Medya'} · Yönetim`;
  }, [tab]);

  if (!tab) return <Navigate to="/admin/media/backgrounds" replace />;
  const isLibrary = LIBRARY_TABS.includes(tab);

  return (
    <>
      <PageHeader
        title="Medya Yönetimi"
        description="Arka planlar, müzikler, profil fotoğrafları, imleçler ve duvar kağıtları. Video dosyaları sunucuda işlenir; durum otomatik güncellenir."
      />
      <div className="grid gap-6">
        <TabNav />
        {isLibrary ? (
          <LibraryTab key={tab.type} tab={tab} canEdit={canEdit} />
        ) : (
          <ContentTab key={tab.type} tab={tab} canEdit={canEdit} />
        )}
        <StorageSummary />
      </div>
    </>
  );
}
