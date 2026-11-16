// CMS.md §3.3, Şartname §15.8 — üstte "Kategori Oluştur" + "Proje Oluştur"; liste: kapak, başlık,
// kategoriler, durum, görüntülenme, güncellenme, sıralama tutamacı, eylemler.
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { hasPermission, normalizeKey } from '@vasquez/shared';
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
import { Badge } from '@/components/ui/badge.jsx';
import { Button, buttonVariants } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { adminKeys, projectsApi } from '../../lib/adminApi.js';
import { CategoryDialog } from '../categories/CategoryDialog.jsx';
import { MediaPreview } from '../media/MediaPreview.jsx';

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' });

function DeleteProjectDialog({ project, onClose }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => projectsApi.remove(project.id),
    onSuccess: () => {
      toast.success('Proje silindi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
      queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <AlertDialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{project?.title}” silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Proje ve tüm görselleri kalıcı olarak silinir; bu işlem geri alınamaz.
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

function Row({ project, handle, canEdit, sortable, onDelete }) {
  const cover = project.images[0]?.asset ?? null;
  return (
    <div className="bg-card flex min-h-[64px] items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2">
      {canEdit && sortable && (
        <DragHandle handle={handle} label={`${project.title} sırasını değiştir`} />
      )}
      <div className="relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-2)]">
        {cover && <MediaPreview asset={cover} />}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/admin/projects/${project.id}`}
          className="block truncate font-medium hover:underline"
        >
          {project.title}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {project.categories.map((c) => c.name).join(' · ') || 'Kategorisiz'}
        </p>
      </div>
      <div className="text-muted-foreground hidden w-28 text-right text-xs md:block">
        <span className="tabular-nums">{project.viewCount}</span> görüntülenme
        <br />
        {dateFormat.format(new Date(project.updatedAt))}
      </div>
      <Badge variant={project.isPublished ? 'default' : 'secondary'} className="shrink-0">
        {project.isPublished ? 'Yayında' : 'Taslak'}
      </Badge>
      <Link
        to={`/admin/projects/${project.id}`}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        aria-label={`${project.title} düzenle`}
      >
        <Pencil aria-hidden="true" />
      </Link>
      {canEdit && (
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`${project.title} sil`}>
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function ProjectsPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'projects:write');
  const canCategories = hasPermission(admin, 'categories:write');
  const queryClient = useQueryClient();
  const key = adminKeys.projects();
  const projects = useQuery({ queryKey: key, queryFn: () => projectsApi.list() });
  const [q, setQ] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    document.title = 'Projeler · Yönetim';
  }, []);

  const reorder = useMutation({
    mutationFn: (next) => projectsApi.reorder(next.map((p) => p.id)),
    onMutate: (next) => {
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onSuccess: () => toast.success('Sıralama kaydedildi.'),
    onError: (error, _n, ctx) => {
      queryClient.setQueryData(key, ctx?.previous);
      toast.error(getErrorMessage(error));
    },
  });

  const all = useMemo(() => projects.data ?? [], [projects.data]);
  const filtered = useMemo(() => {
    const needle = normalizeKey(q);
    return needle ? all.filter((p) => normalizeKey(p.title).includes(needle)) : all;
  }, [all, q]);
  const sortable = !q; // sıralama tüm listeyle yapılır

  return (
    <>
      <PageHeader
        title="Projeler"
        description="Sıra, public sayfadaki kart sırasıdır. İlk görsel kartın kapağıdır."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCategories && (
              <Button variant="outline" onClick={() => setCreatingCategory(true)}>
                <Tags aria-hidden="true" />
                Kategori oluştur
              </Button>
            )}
            {canEdit && (
              <Link to="/admin/projects/new" className={buttonVariants()}>
                <Plus aria-hidden="true" />
                Proje oluştur
              </Link>
            )}
          </div>
        }
      />
      {all.length > 0 && (
        <div className="relative mb-4 max-w-sm">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Başlıkta ara"
            aria-label="Projelerde ara"
            className="pl-9"
          />
        </div>
      )}
      {projects.isPending && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}
      {projects.isError && <ErrorState onRetry={() => projects.refetch()} />}
      {projects.isSuccess && all.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="Henüz proje yok."
          description="İlk projeni oluştur; yayına aldığında ana sayfada Projeler bölümü görünür."
          action={
            canEdit && (
              <Link to="/admin/projects/new" className={buttonVariants()}>
                <Plus aria-hidden="true" />
                Proje oluştur
              </Link>
            )
          }
        />
      )}
      {all.length > 0 && filtered.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">Eşleşen proje yok.</p>
      )}
      {filtered.length > 0 && (
        <SortableList
          items={filtered}
          aria-label="Projeler"
          disabled={!canEdit || !sortable || reorder.isPending}
          onReorder={(next) => reorder.mutate(next)}
          className="grid gap-2"
          renderItem={(project, { handle }) => (
            <Row
              project={project}
              handle={handle}
              canEdit={canEdit}
              sortable={sortable}
              onDelete={() => setDeleting(project)}
            />
          )}
        />
      )}
      <CategoryDialog open={creatingCategory} onClose={() => setCreatingCategory(false)} />
      <DeleteProjectDialog project={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
