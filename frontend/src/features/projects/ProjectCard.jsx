// "Proje kartı" — 16:10 kapak, başlık h3, 2 satır özet, kategori çipleri (maks. 3 + "+n").
// Kartın tamamı link. Admin canlı önizlemesi `href` vermeden aynı görünümü kullanır.
import { ImageIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

const MAX_CHIPS = 3;

export function CategoryChips({ categories, max = MAX_CHIPS, className }) {
  if (!categories?.length) return null;
  const shown = categories.slice(0, max);
  const rest = categories.length - shown.length;
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Kategoriler">
      {shown.map((c) => (
        <li
          key={c.id}
          className="type-meta rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[0.75rem]"
        >
          {c.name}
        </li>
      ))}
      {rest > 0 && (
        <li className="type-meta text-muted-foreground px-1 py-0.5 text-[0.75rem]">+{rest}</li>
      )}
    </ul>
  );
}

function Cover({ cover }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-md)] bg-[var(--surface-2)]">
      {cover ? (
        <img
          src={cover.thumbUrl ?? cover.url}
          alt={cover.alt ?? ''}
          loading="lazy"
          decoding="async"
          width={cover.width ?? undefined}
          height={cover.height ?? undefined}
          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        />
      ) : (
        <span className="text-muted-foreground grid size-full place-items-center">
          <ImageIcon aria-hidden="true" className="size-7" />
        </span>
      )}
    </div>
  );
}

/** @param {{ project: object, href?: string|null, className?: string }} props */
export function ProjectCard({ project, href = `/projects/${project.slug}`, className }) {
  const body = (
    <>
      <Cover cover={project.cover} />
      <div className="flex flex-1 flex-col gap-2 px-1 pt-3 pb-1">
        <h3 className="type-h3 line-clamp-2 break-words">{project.title}</h3>
        {project.excerpt && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{project.excerpt}</p>
        )}
        <CategoryChips categories={project.categories} className="mt-auto pt-1" />
      </div>
    </>
  );
  const shell = cn(
    'surface-chrome group flex h-full flex-col rounded-[var(--radius-lg)] border p-3 transition-[transform,border-color] duration-200',
    href &&
      'hover:-translate-y-0.5 hover:border-[var(--border-strong)] focus-visible:ring-ring/60 outline-none focus-visible:ring-2',
    className,
  );
  return href ? (
    <Link to={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
