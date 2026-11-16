// FR-DL-05, RULES §8.6 "Medya kartı" — sabit oran (wallpaper 16:9, pfp 1:1), başlık + İndir.
// Medya alanı lightbox'ı açan buton; video kartında sağ üstte "MP4" rozeti.
import { useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartMedia } from './SmartMedia.jsx';
import { StaggerItem } from '@/features/motion/Reveal.jsx';

export const ASPECT = { wallpapers: 'aspect-video', pfps: 'aspect-square' };

export function DownloadLink({ item, className }) {
  return (
    <a
      href={item.downloadUrl}
      download
      aria-label={`${item.title} indir`}
      className={cn(
        'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/60 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
    >
      <Download aria-hidden="true" className="size-4" />
      İndir
    </a>
  );
}

export function MediaCard({ item, kind, onOpen }) {
  const [active, setActive] = useState(false);
  const on = () => setActive(true);
  const off = () => setActive(false);
  return (
    <StaggerItem
      as="li"
      className="surface-chrome group overflow-hidden rounded-[var(--radius-lg)] border"
    >
      <button
        type="button"
        onClick={onOpen}
        onPointerEnter={on}
        onPointerLeave={off}
        onFocus={on}
        onBlur={off}
        aria-label={`${item.title} — büyük önizleme`}
        className={cn(
          'focus-visible:ring-ring/60 relative block w-full overflow-hidden bg-[var(--surface-2)] outline-none focus-visible:ring-2 focus-visible:ring-inset',
          ASPECT[kind],
        )}
      >
        <SmartMedia
          item={item}
          active={active}
          className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
        {item.type === 'VIDEO' && (
          <span className="type-meta absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] text-white">
            MP4
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="min-w-0 truncate text-sm font-medium" title={item.title}>
          {item.title}
        </p>
        <DownloadLink item={item} />
      </div>
    </StaggerItem>
  );
}
