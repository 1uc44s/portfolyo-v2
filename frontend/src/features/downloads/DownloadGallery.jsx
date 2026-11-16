// FR-DL-01/02/04 — sonsuz kaydırmalı grid (keyset, sayfa 24). Wallpaper: 1/2/3 sütun,
// pfp: 2/3/4 sütun. Sentinel IntersectionObserver ile yükler; klavye için "Daha fazla" butonu da var.
import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ImageOff, Loader2 } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { Button, buttonVariants } from '@/components/ui/button.jsx';
import { fetchDownloads } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { cn } from '@/lib/utils';
import { Lightbox } from './Lightbox.jsx';
import { ASPECT, MediaCard } from './MediaCard.jsx';
import { Stagger } from '@/features/motion/Reveal.jsx';

export const GRID = {
  wallpapers: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  pfps: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
};

export function EmptyDownloads() {
  return (
    <EmptyState
      icon={ImageOff}
      title="Şu anda indirilebilir içerik yok."
      description="Yeni içerikler eklendiğinde burada görünecek."
      action={
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          Ana sayfaya dön
        </Link>
      }
      className="surface-chrome mx-auto max-w-xl"
    />
  );
}

function GridSkeleton({ kind, count = 6 }) {
  return (
    <ul aria-hidden="true" className={cn('grid gap-4', GRID[kind])}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="surface-chrome overflow-hidden rounded-[var(--radius-lg)] border">
          <div className={cn('bg-muted animate-pulse', ASPECT[kind])} />
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="bg-muted h-3.5 w-28 animate-pulse rounded-full" />
            <div className="bg-muted h-9 w-20 animate-pulse rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DownloadGallery({ kind }) {
  const sentinel = useRef(null);
  const [index, setIndex] = useState(null);
  const query = useInfiniteQuery({
    queryKey: queryKeys.downloads(kind),
    queryFn: ({ pageParam }) => fetchDownloads(kind, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    staleTime: 60_000,
  });
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (query.isPending) return <GridSkeleton kind={kind} />;
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;
  if (items.length === 0) return <EmptyDownloads />;

  return (
    <>
      <Stagger as="ul" className={cn('grid gap-4', GRID[kind])}>
        {items.map((item, i) => (
          <MediaCard key={item.publicId} item={item} kind={kind} onOpen={() => setIndex(i)} />
        ))}
      </Stagger>
      {hasNextPage && (
        <div ref={sentinel} className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 aria-hidden="true" className="animate-spin" />}
            {isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla göster'}
          </Button>
        </div>
      )}
      <Lightbox
        items={items}
        index={index}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        hasMore={Boolean(hasNextPage)}
        onLoadMore={() => fetchNextPage()}
      />
    </>
  );
}
