// büyük önizleme: ok tuşlarıyla önceki/sonraki, Escape kapatır (Radix Dialog).
// Video gerçek oynatıcıyla (controls, loop); görsel ana varyant.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.jsx';
import { DownloadLink } from './MediaCard.jsx';

const navButton =
  'bg-black/55 hover:bg-black/75 focus-visible:ring-ring/70 absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-white transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-0';

export function Lightbox({ items, index, onIndexChange, onClose, hasMore, onLoadMore }) {
  const item = index === null ? null : items[index];
  const hasPrev = index > 0;
  const hasNext = index !== null && (index < items.length - 1 || hasMore);

  const go = (delta) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= items.length) {
      if (hasMore) onLoadMore();
      return;
    }
    onIndexChange(next);
  };

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      {item && (
        <DialogContent
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'ArrowRight') go(1);
          }}
          className="max-h-[92dvh] w-[min(96vw,1200px)] max-w-none gap-3 border-none bg-[var(--surface)] p-3 sm:max-w-none sm:p-4"
        >
          <div className="relative grid min-h-0 place-items-center overflow-hidden rounded-[var(--radius-md)] bg-black">
            {item.type === 'VIDEO' ? (
              <video
                key={item.publicId}
                src={item.previewUrl}
                poster={item.posterUrl ?? undefined}
                controls
                loop
                autoPlay
                muted
                playsInline
                className="max-h-[74dvh] w-full object-contain"
              />
            ) : (
              <img
                key={item.publicId}
                src={item.previewUrl}
                alt={item.title}
                className="max-h-[74dvh] w-auto max-w-full object-contain"
              />
            )}
            <button
              type="button"
              className={`${navButton} left-2`}
              onClick={() => go(-1)}
              disabled={!hasPrev}
              aria-label="Önceki"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            <button
              type="button"
              className={`${navButton} right-2`}
              onClick={() => go(1)}
              disabled={!hasNext}
              aria-label="Sonraki"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 pr-10 pl-1">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base">{item.title}</DialogTitle>
              <DialogDescription className="type-meta">
                {index + 1} / {items.length}
                {hasMore ? '+' : ''} · ok tuşlarıyla gezin
              </DialogDescription>
            </div>
            <DownloadLink item={item} />
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
