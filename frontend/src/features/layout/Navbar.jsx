// FR-NAV-01..04, RULES §8.6 — yüzen kapsül navbar; içeriği olmayan sayfaların linki gösterilmez.
import { useEffect, useState } from 'react';
import { Layers, Menu, Moon, Sparkles, Square, Sun, Wind, X } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { useSite } from '@/features/site/useSite.js';
import { usePrefs } from '@/lib/prefs.js';
import { cn } from '@/lib/utils';
import { AnimatePresence, m } from 'motion/react';
import { useWelcome } from '@/features/welcome/welcomeStore.js';

// FR-NAV-05 — ada navbar karşılama kapanınca (ya da açılışta) yukarıdan iner.
const HIDDEN = { y: '-140%', opacity: 0 };
const SHOWN = { y: 0, opacity: 1 };

const linkClass = ({ isActive }) =>
  cn(
    'inline-flex min-h-10 items-center rounded-full px-4 text-sm transition-colors',
    isActive
      ? 'bg-surface-2 text-foreground font-medium'
      : 'text-muted-foreground hover:text-foreground',
  );

function IconButton({ label, pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="text-muted-foreground hover:bg-accent hover:text-foreground grid size-10 place-items-center rounded-full transition-colors [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function Controls() {
  const { theme, surface, effects, toggleTheme, toggleSurface, toggleEffects } = usePrefs();
  return (
    <div className="flex items-center">
      <IconButton
        label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      </IconButton>
      <IconButton
        label={surface === 'glass' ? 'Klasik görünüme geç' : 'Cam görünüme geç'}
        pressed={surface === 'glass'}
        onClick={toggleSurface}
      >
        {surface === 'glass' ? <Layers aria-hidden="true" /> : <Square aria-hidden="true" />}
      </IconButton>
      <IconButton
        label={effects === 'full' ? 'Düşük efekt moduna geç' : 'Tam efekt moduna geç'}
        pressed={effects === 'low'}
        onClick={toggleEffects}
      >
        {effects === 'full' ? <Sparkles aria-hidden="true" /> : <Wind aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

export function Navbar() {
  const { data } = useSite();
  const entered = useWelcome((s) => s.entered);
  const links = [
    { to: '/', label: 'Portfolyo', end: true, show: true },
    { to: '/wallpapers', label: 'Duvar Kağıtları', show: data?.nav?.wallpapers },
    { to: '/pfps', label: 'Profil Fotoğrafları', show: data?.nav?.pfps },
  ].filter((l) => l.show);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const items = (extra) =>
    links.map((l) => (
      <li key={l.to}>
        <NavLink to={l.to} end={l.end} className={(s) => cn(linkClass(s), extra)}>
          {l.label}
        </NavLink>
      </li>
    ));

  return (
    <m.header
      initial={HIDDEN}
      animate={entered ? SHOWN : HIDDEN}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: entered ? 0.1 : 0 }}
      className="sticky top-0 z-[var(--z-navbar)] px-3 pt-3"
    >
      <div className="surface-chrome relative mx-auto max-w-[1200px] rounded-[var(--radius-xl)] border">
        <nav aria-label="Ana menü" className="flex h-16 items-center gap-2 px-3 sm:px-4">
          <NavLink
            to="/"
            className="font-display mr-auto truncate px-2 text-lg font-semibold tracking-tight"
          >
            {data?.navbarTitle ?? '1uc44s GitHub'}
          </NavLink>
          <ul className="hidden items-center gap-1 md:flex">{items()}</ul>
          <span aria-hidden="true" className="bg-border mx-1 hidden h-6 w-px md:block" />
          <Controls />
          <button
            type="button"
            className="hover:bg-accent grid size-10 place-items-center rounded-full md:hidden"
            aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </nav>
        {/* Mobil menü: başlığın altında süzülen panel — sayfa akışını itmez (içerik kaymaz). */}
        <AnimatePresence>
          {open && (
            <m.ul
              id="mobile-menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="surface-chrome absolute inset-x-0 top-full mt-2 grid origin-top gap-1 rounded-[var(--radius-xl)] border p-3 shadow-lg md:hidden"
            >
              {items('w-full')}
            </m.ul>
          )}
        </AnimatePresence>
      </div>
    </m.header>
  );
}
