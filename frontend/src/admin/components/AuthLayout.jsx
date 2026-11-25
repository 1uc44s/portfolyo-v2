// Giriş akışı kabuğu: atmosferik sahne + tek cam kart (kimlik public siteyle ortak).
import { m } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/common/BrandMark.jsx';
import { PrefsControls } from './PrefsControls.jsx';

/**
 * @param {{ eyebrow?: string, title: string, description?: import('react').ReactNode,
 *   children: import('react').ReactNode, footer?: import('react').ReactNode }} props
 */
export function AuthLayout({ eyebrow = 'Yönetim', title, description, children, footer }) {
  return (
    <div className="scene-fallback relative flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Siteye dön
        </Link>
        <PrefsControls showEffects={false} />
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-16">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="surface-chrome rounded-[var(--radius-xl)] border p-6 shadow-[var(--shadow-lg)] sm:p-8">
            <div className="mb-6 flex flex-col gap-4">
              <BrandMark />
              <div className="space-y-1.5">
                <p className="type-eyebrow">{eyebrow}</p>
                <h1 className="type-h1">{title}</h1>
                {description && (
                  <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
                )}
              </div>
            </div>
            {children}
          </div>
          {footer && <div className="text-muted-foreground mt-5 text-center text-sm">{footer}</div>}
        </m.div>
      </main>
    </div>
  );
}

/** Formun genel (alan dışı) hatası — ekran okuyucuya hemen duyurulur. */
export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="border-danger/30 bg-danger/10 text-foreground rounded-[var(--radius-md)] border px-3 py-2.5 text-sm"
    >
      {children}
    </p>
  );
}
