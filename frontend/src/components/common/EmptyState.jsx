// RULES §8.7 — boş durum: ikon + bir cümle + (varsa) eylem.
import { cn } from '@/lib/utils';

/**
 * @param {{ icon?: import('react').ElementType, title: string, description?: string,
 *   action?: import('react').ReactNode, className?: string }} props
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="bg-surface-2 text-muted-foreground grid size-12 place-items-center rounded-full">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className="type-h3">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
