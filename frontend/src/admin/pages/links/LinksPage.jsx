// ADMIN.md §3.10, US-25 AC3 — sol: sıralanabilir liste (görsel, başlık, kısaltılmış URL, aktif anahtarı);
// sağ: gerçek `LinksView` ile public önizleme + genişlik simülatörü (Masaüstü 1280 / Tablet 768 / Mobil 375).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@vasquez/shared';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { LinksView } from '@/features/links/LinksSection.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../components/PageHeader.jsx';
import { adminKeys, linksApi } from '../../lib/adminApi.js';
import { MediaPreview } from '../media/MediaPreview.jsx';
import { LinkFormDialog } from './LinkFormDialog.jsx';

export const WIDTHS = [
  { label: 'Masaüstü', px: 1280 },
  { label: 'Tablet', px: 768 },
  { label: 'Mobil', px: 375 },
];

const shortUrl = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

/** Aktif link → public kart verisi (aktif + hazır asset public /media'dan okunabilir). */
export const toPreviewLink = (link) => ({
  id: link.id,
  title: link.title,
  url: link.url,
  image: {
    url: `/media/${link.image.id}/main`,
    thumbUrl: `/media/${link.image.id}/${link.image.thumbUrl ? 'thumb' : 'main'}`,
  },
});

function WidthSimulator({ links }) {
  const [width, setWidth] = useState(WIDTHS[0].px);
  const outer = useRef(null);
  const inner = useRef(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const available = outer.current?.clientWidth ?? width;
      const scale = Math.min(1, available / width);
      setBox({ scale, height: (inner.current?.offsetHeight ?? 0) * scale });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width, links]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="type-meta text-muted-foreground">Public önizleme · {width} px</p>
        <div role="group" aria-label="Önizleme genişliği" className="flex gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w.px}
              type="button"
              aria-pressed={width === w.px}
              onClick={() => setWidth(w.px)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                width === w.px
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {w.label} {w.px}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={outer}
        className="scene-fallback overflow-hidden rounded-[var(--radius-xl)] border"
        style={{ height: box.height || undefined }}
      >
        <div
          ref={inner}
          data-testid="links-preview"
          style={{ width, transform: `scale(${box.scale})`, transformOrigin: 'top left' }}
        >
          {links.length > 0 ? (
            <LinksView links={links} headingLevel="p" />
          ) : (
            <p className="text-muted-foreground px-6 py-12 text-center text-sm">
              Aktif link yok; public sayfada bölüm görünmez.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteLinkDialog({ link, onClose }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => linksApi.remove(link.id),
    onSuccess: () => {
      toast.success('Link silindi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.links });
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <AlertDialog open={Boolean(link)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{link?.title}” silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Link ve görseli kalıcı olarak silinir; bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate();
            }}
          >
            {remove.isPending ? 'Siliniyor…' : 'Sil'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function LinksPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'links:write');
  const queryClient = useQueryClient();
  const key = adminKeys.links;
  const query = useQuery({ queryKey: key, queryFn: linksApi.list });
  const [editing, setEditing] = useState(null); // null kapalı, {} yeni
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    document.title = 'Linkler · Yönetim';
  }, []);

  const optimistic = (next) => {
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, next);
    return { previous };
  };
  const rollback = (error, _v, ctx) => {
    queryClient.setQueryData(key, ctx?.previous);
    toast.error(getErrorMessage(error));
  };
  const reorder = useMutation({
    mutationFn: (next) => linksApi.reorder(next.map((l) => l.id)),
    onMutate: optimistic,
    onError: rollback,
    onSuccess: () => toast.success('Sıralama kaydedildi.'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => linksApi.update(id, { isActive }),
    onMutate: ({ id, isActive }) =>
      optimistic(queryClient.getQueryData(key)?.map((l) => (l.id === id ? { ...l, isActive } : l))),
    onError: rollback,
  });

  const list = query.data ?? [];
  const preview = list.filter((l) => l.isActive && l.image.processingStatus === 'READY');

  return (
    <>
      <PageHeader
        title="Linkler"
        description="Hakkımda bölümünün altında görünür. Sıra, public sayfadaki kart sırasıdır."
        actions={
          canEdit && (
            <Button onClick={() => setEditing({})}>
              <Plus aria-hidden="true" />
              Link ekle
            </Button>
          )
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          {query.isPending && (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {query.isError && <ErrorState onRetry={() => query.refetch()} />}
          {query.isSuccess && list.length === 0 && (
            <EmptyState
              icon={Link2}
              title="Henüz link yok."
              description="Sosyal profillerini ve önemli bağlantılarını ekle."
              action={
                canEdit && (
                  <Button onClick={() => setEditing({})}>
                    <Plus aria-hidden="true" />
                    Link ekle
                  </Button>
                )
              }
            />
          )}
          {list.length > 0 && (
            <SortableList
              items={list}
              aria-label="Linkler"
              disabled={!canEdit || reorder.isPending}
              onReorder={(next) => reorder.mutate(next)}
              className="grid gap-2"
              renderItem={(link, { handle }) => (
                <div className="bg-card flex min-h-16 items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2">
                  {canEdit && (
                    <DragHandle handle={handle} label={`${link.title} sırasını değiştir`} />
                  )}
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)]">
                    <MediaPreview asset={link.image} alt="" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{link.title}</p>
                    <p className="text-muted-foreground truncate text-xs" title={link.url}>
                      {shortUrl(link.url)}
                    </p>
                  </div>
                  <Switch
                    checked={link.isActive}
                    disabled={!canEdit}
                    onCheckedChange={(isActive) => toggle.mutate({ id: link.id, isActive })}
                    aria-label={`${link.title} aktif`}
                  />
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing(link)}
                        aria-label={`${link.title} düzenle`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(link)}
                        aria-label={`${link.title} sil`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            />
          )}
        </div>
        <div className="xl:sticky xl:top-24">
          <WidthSimulator links={preview.map(toPreviewLink)} />
        </div>
      </div>
      <LinkFormDialog
        open={editing !== null}
        link={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
      />
      <DeleteLinkDialog link={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
