// ADMIN.md §3.1 — sidebar (12 öğe, izin filtreli), üst bar, mobil çekmece, kullanıcı menüsü.
import { useState } from 'react';
import { ExternalLink, LogOut, Menu, ShieldCheck } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BrandMark } from '@/components/common/BrandMark.jsx';
import { Avatar, AvatarFallback } from '@/components/ui/avatar.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { ScrollArea } from '@/components/ui/scroll-area.jsx';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { logout } from '@/lib/auth/session.js';
import { cn } from '@/lib/utils';
import { PageTransition } from '@/features/motion/Reveal.jsx';
import { findNavItem, visibleNavGroups } from '../lib/navigation.js';
import { UnreadBadge } from './UnreadBadge.jsx';
import { PrefsControls } from './PrefsControls.jsx';

const ROLE_LABEL = { SUPER_ADMIN: 'Süper Admin', EDITOR: 'Editör' };

const initialsOf = (admin) =>
  (admin?.displayName || admin?.email || '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('tr-TR'))
    .join('');

function useSignOut() {
  const navigate = useNavigate();
  return async () => {
    await logout().catch(() => {});
    navigate('/admin/login', { replace: true });
  };
}

function SidebarNav({ onNavigate }) {
  const admin = useAuthStore((s) => s.admin);
  return (
    <nav aria-label="Yönetim menüsü" className="flex flex-col gap-6 px-3 py-4">
      {visibleNavGroups(admin).map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="type-eyebrow px-3 pb-1">{group.label}</p>
          {group.items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex min-h-10 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-primary-soft text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', isActive && 'text-primary')}
                  />
                  <span className="truncate">{label}</span>
                  {badge === 'unreadMessages' && <UnreadBadge />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }) {
  const admin = useAuthStore((s) => s.admin);
  const signOut = useSignOut();
  return (
    <div className="flex h-full flex-col">
      <Link
        to="/admin"
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-3 border-b px-5"
      >
        <BrandMark className="size-8" />
        <span className="flex flex-col leading-tight">
          <span className="font-display text-[0.9375rem] font-semibold tracking-tight">
            vasquez
          </span>
          <span className="type-eyebrow text-[0.6875rem]">Yönetim</span>
        </span>
      </Link>
      <ScrollArea className="min-h-0 flex-1">
        <SidebarNav onNavigate={onNavigate} />
      </ScrollArea>
      <div className="flex items-center gap-3 border-t p-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-surface-3 text-xs font-semibold">
            {initialsOf(admin)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{admin?.displayName || admin?.email}</p>
          <p className="text-muted-foreground truncate text-xs">{ROLE_LABEL[admin?.role]}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Çıkış yap"
          className="text-muted-foreground hover:text-foreground"
          onClick={signOut}
        >
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function UserMenu() {
  const admin = useAuthStore((s) => s.admin);
  const navigate = useNavigate();
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Hesap menüsü" className="rounded-full">
          <Avatar className="size-8">
            <AvatarFallback className="bg-surface-3 text-xs font-semibold">
              {initialsOf(admin)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{admin?.displayName || 'Yönetici'}</p>
          <p className="text-muted-foreground truncate text-xs">{admin?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/admin/account')}>
          <ShieldCheck aria-hidden="true" />
          Hesap Ayarları
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Siteyi görüntüle
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={signOut}>
          <LogOut aria-hidden="true" />
          Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Topbar({ onOpenMenu }) {
  const { pathname } = useLocation();
  const current = findNavItem(pathname);
  return (
    <header className="surface-chrome sticky top-0 z-[var(--z-navbar)] flex h-16 items-center gap-3 border-b px-4 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Menüyü aç"
        onClick={onOpenMenu}
      >
        <Menu aria-hidden="true" />
      </Button>
      <nav aria-label="Konum" className="type-meta text-muted-foreground min-w-0 truncate">
        <span className="hidden sm:inline">Yönetim</span>
        {current && (
          <>
            <span aria-hidden="true" className="mx-2 hidden opacity-50 sm:inline">
              /
            </span>
            <span className="text-foreground">{current.label}</span>
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <PrefsControls />
        <span aria-hidden="true" className="bg-border mx-1 hidden h-6 w-px sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="bg-background min-h-dvh">
      <a
        href="#admin-main"
        className="bg-primary text-primary-foreground sr-only z-[var(--z-toast)] rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        İçeriğe geç
      </a>

      <aside className="surface-chrome fixed inset-y-0 left-0 z-[var(--z-navbar)] hidden w-64 border-r lg:block">
        <SidebarContent />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Yönetim menüsü</SheetTitle>
          <SidebarContent onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8"
        >
          <PageTransition routeKey={pathname}>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
