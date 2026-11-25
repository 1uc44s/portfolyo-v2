// ana sayfa Projeler bölümü: yayında proje yoksa render edilmez (site bayrağı).
// Kategori filtresi istemci tarafında (liste küçük); çip sırası admin kategori sırası.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { fetchProjectCategories, fetchProjects } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { cn } from '@/lib/utils';
import { ProjectCard } from './ProjectCard.jsx';
import { Stagger, StaggerItem } from '@/features/motion/Reveal.jsx';

const GRID = 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3';

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/60 min-h-9 rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-2',
        active
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'surface-chrome text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function GridSkeleton() {
  return (
    <ul aria-hidden="true" className={GRID}>
      {[0, 1, 2].map((i) => (
        <li key={i} className="surface-chrome rounded-[var(--radius-lg)] border p-3">
          <div className="bg-muted aspect-[16/10] animate-pulse rounded-[var(--radius-md)]" />
          <div className="bg-muted mt-4 h-5 w-2/3 animate-pulse rounded-full" />
          <div className="bg-muted mt-2 h-3.5 w-full animate-pulse rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function ProjectsSection() {
  const [category, setCategory] = useState(null);
  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
    staleTime: 60_000,
  });
  const categories = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: fetchProjectCategories,
    staleTime: 60_000,
  });

  const list = projects.data ?? [];
  const shown = category ? list.filter((p) => p.categories.some((c) => c.id === category)) : list;
  const chips = categories.data ?? [];

  return (
    <section
      id="projeler"
      aria-labelledby="projects-title"
      className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-16 sm:px-6"
    >
      <h2 id="projects-title" className="type-h1 mb-6 text-center">
        Projeler
      </h2>
      {chips.length > 1 && (
        <div
          role="group"
          aria-label="Kategoriye göre filtrele"
          className="mb-8 flex flex-wrap justify-center gap-2"
        >
          <Chip active={category === null} onClick={() => setCategory(null)}>
            Tümü
          </Chip>
          {chips.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.name}
            </Chip>
          ))}
        </div>
      )}
      {projects.isPending && <GridSkeleton />}
      {projects.isError && <ErrorState onRetry={() => projects.refetch()} />}
      {projects.isSuccess && (
        <Stagger as="ul" className={GRID}>
          {shown.map((p) => (
            <StaggerItem as="li" key={p.slug}>
              <ProjectCard project={p} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}
