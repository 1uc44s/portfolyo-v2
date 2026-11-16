// Marka işareti: favicon ile aynı "V" glifi, renk token'dan gelir.
import { cn } from '@/lib/utils';

export function BrandMark({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-primary-soft text-primary grid size-9 place-items-center rounded-[var(--radius-md)] ring-1 ring-[var(--accent-glow)]',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-5" fill="none">
        <path
          d="M9 9l7 14 7-14"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
