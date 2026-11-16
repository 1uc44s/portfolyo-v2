// Ayar bölümü kartı: başlık, açıklama, içerik ve sağa yaslı eylem satırı (FR-ADM-02).
import { cn } from '@/lib/utils';

/**
 * @param {{ title: string, description?: import('react').ReactNode, children: import('react').ReactNode,
 *   footer?: import('react').ReactNode, className?: string, tone?: 'default'|'danger' }} props
 */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
  tone = 'default',
}) {
  return (
    <section
      className={cn(
        'bg-card overflow-hidden rounded-[var(--radius-lg)] border',
        tone === 'danger' && 'border-danger/35',
        className,
      )}
    >
      <div className="space-y-1 px-5 pt-5 sm:px-6 sm:pt-6">
        <h2 className="type-h3">{title}</h2>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <div className="bg-surface-2/60 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3 sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}
