// CMS.md §3.1, ADMIN.md — kategoriler: sürükle-bırak sıra (public filtre sırası), aktif anahtarı,
// proje sayısı, düzenle/sil. Sistem varsayılan kategori oluşturmaz.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission } from '@vasquez/shared';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { adminKeys, categoriesApi } from '../../lib/adminApi.js';
import { CategoryDialog } from './CategoryDialog.jsx';
import { DeleteCategoryDialog } from './DeleteCategoryDialog.jsx';

export function useCategories() {
  return useQuery({ queryKey: adminKeys.categories, queryFn: categoriesApi.list });
}

function useCategoryMutations() {
  const queryClient = useQueryClient();
  const key = adminKeys.categories;
  const reorder = useMutation({
    mutationFn: (next) => categoriesApi.reorder(next.map((c) => c.id)),
    onMutate: (next) => {
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, next);
      return { previous };
    },
    onError: (error, _next, context) => {
      queryClient.setQueryData(key, context?.previous);
      toast.error(getErrorMessage(error));
    },
    onSuccess: () => toast.success('Sıralama kaydedildi.'),
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => categoriesApi.update(id, { isActive }),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, (list) => list?.map((c) => (c.id === saved.id ? saved : c)));
      queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return { reorder, toggle };
}

function Row({ category, handle, canEdit, onEdit, onDelete, onToggle }) {
  return (
    <div className="bg-card flex min-h-[52px] items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2">
      {canEdit && <DragHandle handle={handle} label={`${category.name} sırasını değiştir`} />}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{category.name}</p>
        <p className="text-muted-foreground text-xs">{category.projectCount} proje</p>
      </div>
      {!category.isActive && <Badge variant="secondary">Pasif</Badge>}
      <Switch
        checked={category.isActive}
        disabled={!canEdit}
        onCheckedChange={(isActive) => onToggle(isActive)}
        aria-label={`${category.name} aktif`}
      />
      {canEdit && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={`${category.name} düzenle`}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={`${category.name} sil`}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'categories:write');
  const categories = useCategories();
  const { reorder, toggle } = useCategoryMutations();
  const [editing, setEditing] = useState(null); // null kapalı, {} yeni, kategori düzenle
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    document.title = 'Kategoriler · Yönetim';
  }, []);

  const list = categories.data ?? [];

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Projeleri gruplar. Sıra, public sayfadaki filtre çiplerinin sırasıdır."
        actions={
          canEdit && (
            <Button onClick={() => setEditing({})}>
              <Plus aria-hidden="true" />
              Kategori oluştur
            </Button>
          )
        }
      />
      {categories.isPending && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[52px]" />
          ))}
        </div>
      )}
      {categories.isError && <ErrorState onRetry={() => categories.refetch()} />}
      {categories.isSuccess && list.length === 0 && (
        <EmptyState
          icon={Tags}
          title="Henüz kategori yok."
          description="Sistem varsayılan kategori oluşturmaz; ilk kategoriyi sen ekle."
          action={
            canEdit && (
              <Button onClick={() => setEditing({})}>
                <Plus aria-hidden="true" />
                Kategori oluştur
              </Button>
            )
          }
        />
      )}
      {list.length > 0 && (
        <SortableList
          items={list}
          aria-label="Kategoriler"
          labelOf={(c) => c?.name}
          disabled={!canEdit || reorder.isPending}
          onReorder={(next) => reorder.mutate(next)}
          className="grid gap-2"
          renderItem={(category, { handle }) => (
            <Row
              category={category}
              handle={handle}
              canEdit={canEdit}
              onEdit={() => setEditing(category)}
              onDelete={() => setDeleting(category)}
              onToggle={(isActive) => toggle.mutate({ id: category.id, isActive })}
            />
          )}
        />
      )}
      <CategoryDialog
        open={editing !== null}
        category={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
      />
      <DeleteCategoryDialog
        category={deleting}
        categories={list}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
