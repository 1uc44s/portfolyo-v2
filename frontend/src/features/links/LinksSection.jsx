// "Link kartı" — başlık "Linkler"; her kart tek <a> (yeni sekme,
// noopener noreferrer), [görsel 40×40][12 px][başlık]. Yerleşim globals.css `.links-grid` kuralları.
// `LinksView` sunum bileşenidir (admin önizlemesi de kullanır); `LinksSection` veriyi çeker.
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { fetchLinks } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { cn } from '@/lib/utils';
import { Stagger, StaggerItem } from '@/features/motion/Reveal.jsx';

export function LinkCard({ link }) {
  return (
    <StaggerItem as="li" className="link-card list-none">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="surface-chrome focus-visible:ring-primary flex h-16 items-center gap-3 rounded-[var(--radius-md)] border px-3 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      >
        <img
          src={link.image?.thumbUrl ?? link.image?.url}
          alt={link.title}
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          className="size-10 shrink-0 rounded-[var(--radius-sm)] object-cover"
        />
        <span className="min-w-0 truncate text-sm font-medium" title={link.title}>
          {link.title}
        </span>
      </a>
    </StaggerItem>
  );
}

/** @param {{ links: object[], className?: string, headingLevel?: 'h2'|'p' }} props */
export function LinksView({ links, className, headingLevel: Heading = 'h2' }) {
  return (
    <section aria-labelledby="links-title" className={cn('links-section w-full', className)}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6">
        <Heading id="links-title" className="type-h1 mb-8 text-center">
          Linkler
        </Heading>
        <Stagger as="ul" className="links-grid" aria-label="Linkler">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function LinksSkeleton() {
  return (
    <div aria-hidden="true" className="links-section w-full">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6">
        <div className="bg-muted mx-auto mb-8 h-10 w-40 animate-pulse rounded-full" />
        <ul className="links-grid">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="link-card bg-muted h-16 animate-pulse rounded-[var(--radius-md)]"
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Aktif link yoksa hiçbir şey render edilmez. */
export function LinksSection() {
  const query = useQuery({ queryKey: queryKeys.links, queryFn: fetchLinks, staleTime: 60_000 });
  if (query.isPending) return <LinksSkeleton />;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (query.data.length === 0) return null;
  return <LinksView links={query.data} />;
}
