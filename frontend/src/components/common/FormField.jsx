// NFR-A11Y-03 — etiket, açıklama ve hata mesajı erişilebilir biçimde alana bağlanır.
import { cloneElement, isValidElement, useId } from 'react';
import { Label } from '@/components/ui/label.jsx';
import { cn } from '@/lib/utils';

/**
 * Tek çocuk input'a id, aria-invalid ve aria-describedby otomatik eklenir.
 * @param {{ label: string, error?: string, description?: string, children: import('react').ReactElement,
 *   className?: string, labelAction?: import('react').ReactNode }} props
 */
export function FormField({ label, error, description, children, className, labelAction }) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <div className={cn('grid content-start gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {control}
      {description && !error && (
        <p id={descriptionId} className="text-muted-foreground text-xs">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-danger text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
