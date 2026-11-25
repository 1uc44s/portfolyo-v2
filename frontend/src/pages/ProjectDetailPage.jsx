// proje detayı: galeri (+ lightbox), güvenli Markdown açıklama, kategoriler,
// Demo/Video/GitHub (yeni sekme, noopener noreferrer). Yayında değil/yok → gömülü 404.
// Lazy chunk: react-markdown ve Dialog ana public paketine girmez.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  ExternalLink,
  FolderGit2,
} from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { SafeMarkdown } from '@/components/common/SafeMarkdown.jsx';
import { buttonVariants } from '@/components/ui/button.jsx';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.jsx';
import { CategoryChips } from '@/features/projects/ProjectCard.jsx';
import { useSite } from '@/features/site/useSite.js';
import { fetchProject } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { cn } from '@/lib/utils';
import { NotFoundPage } from './NotFoundPage.jsx';
import { useProjectView } from '@/features/consent/useAnalytics.js';
import { Reveal } from '@/features/motion/Reveal.jsx';

const LINKS = [
  { key: 'demo', label: 'Demo', icon: ExternalLink },
  { key: 'video', label: 'Video', icon: CirclePlay },
  { key: 'github', label: 'GitHub', icon: FolderGit2 },
];

const navButton =
  'absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:pointer-events-none disabled:opacity-0';

function Gallery({ images, title }) {
  const [index, setIndex] = useState(null);
  if (images.length === 0) return null;
  const [cover, ...rest] = images;
  const go = (delta) => setIndex((i) => Math.min(images.length - 1, Math.max(0, i + delta)));
  const current = index === null ? null : images[index];

  return (
    <>
      <button
        type="button"
        onClick={() => setIndex(0)}
        aria-label={`${cover.alt} — büyük önizleme`}
        className="focus-visible:ring-ring/60 block w-full overflow-hidden rounded-[var(--radius-lg)] border outline-none focus-visible:ring-2"
      >
        <img
          src={cover.url}
          alt={cover.alt}
          width={cover.width ?? undefined}
          height={cover.height ?? undefined}
          className="aspect-[16/10] w-full object-cover"
        />
      </button>
      {rest.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Diğer görseller">
          {rest.map((img, i) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setIndex(i + 1)}
                aria-label={`${img.alt} — büyük önizleme`}
                className="focus-visible:ring-ring/60 block w-full overflow-hidden rounded-[var(--radius-md)] border outline-none focus-visible:ring-2"
              >
                <img
                  src={img.thumbUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-[16/10] w-full object-cover transition-transform duration-300 hover:scale-[1.04]"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={current !== null} onOpenChange={(open) => !open && setIndex(null)}>
        {current && (
          <DialogContent
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') go(-1);
              if (e.key === 'ArrowRight') go(1);
            }}
            className="w-[min(96vw,1200px)] max-w-none gap-3 border-none bg-[var(--surface)] p-3 sm:max-w-none sm:p-4"
          >
            <div className="relative grid place-items-center overflow-hidden rounded-[var(--radius-md)] bg-black">
              <img
                key={current.url}
                src={current.url}
                alt={current.alt}
                className="max-h-[78dvh] w-auto max-w-full object-contain"
              />
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    aria-label="Önceki"
                    className={`${navButton} left-2`}
                  >
                    <ChevronLeft aria-hidden="true" className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    disabled={index === images.length - 1}
                    aria-label="Sonraki"
                    className={`${navButton} right-2`}
                  >
                    <ChevronRight aria-hidden="true" className="size-6" />
                  </button>
                </>
              )}
            </div>
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="type-meta pl-1">
              {index + 1} / {images.length} · {current.alt}
            </DialogDescription>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export default function ProjectDetailPage() {
  const { slug } = useParams();
  const { data: site } = useSite();
  const query = useQuery({
    queryKey: queryKeys.project(slug),
    queryFn: () => fetchProject(slug),
    retry: (count, error) => error?.response?.status !== 404 && count < 2,
    staleTime: 60_000,
  });
  const project = query.data;
  // yalnızca analitik izni varsa (sunucu günde bir sayar).
  useProjectView(project?.slug);

  useEffect(() => {
    if (!project) return;
    const owner = site?.navbarTitle;
    document.title = owner ? `${project.title} · ${owner}` : project.title;
  }, [project, site?.navbarTitle]);

  if (query.isError && query.error?.response?.status === 404) return <NotFoundPage embedded />;

  return (
    <Reveal as="article" className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
      <Link
        to="/#projeler"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-6 -ml-2')}
      >
        <ArrowLeft aria-hidden="true" />
        Projeler
      </Link>
      {query.isPending && (
        <div aria-hidden="true" className="grid gap-4">
          <div className="bg-muted h-10 w-2/3 animate-pulse rounded-full" />
          <div className="bg-muted aspect-[16/10] animate-pulse rounded-[var(--radius-lg)]" />
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {project && (
        <div className="grid gap-8">
          <header className="grid gap-3">
            <h1 className="type-h1 break-words">{project.title}</h1>
            <CategoryChips categories={project.categories} max={20} />
          </header>
          <Gallery images={project.images} title={project.title} />
          <div className="flex flex-wrap gap-2">
            {LINKS.filter((l) => project.links[l.key]).map(({ key, label, icon: Icon }) => (
              <a
                key={key}
                href={project.links[key]}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: key === 'demo' ? 'default' : 'outline' })}
              >
                <Icon aria-hidden="true" />
                {label}
                <span className="sr-only"> (yeni sekmede açılır)</span>
              </a>
            ))}
          </div>
          <div className="surface-chrome rounded-[var(--radius-lg)] border p-5 sm:p-8">
            <SafeMarkdown>{project.descriptionMarkdown}</SafeMarkdown>
          </div>
        </div>
      )}
    </Reveal>
  );
}
