// içerik türü sekmesi: arama + durum filtresi, ızgara/tablo, sürükle-bırak sıralama,
// PENDING/PROCESSING kayıt varken 3 sn'de bir yeniden çekme, ekle/düzenle/sil.
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, LayoutGrid, Plus, Rows3, Search } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/common/DataTable.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { SortableList } from '@/components/common/SortableList.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { adminKeys, mediaApi } from '../../lib/adminApi.js';
import { ContentFormDialog } from './ContentFormDialog.jsx';
import { ContentCard, FlagToggles, ItemActions, ItemPreview, metaOf } from './ContentItem.jsx';
import { DeleteDialog } from './DeleteDialog.jsx';
import { StatusBadges } from './MediaPreview.jsx';
import { isBusy } from './mediaConfig.js';

export const POLL_INTERVAL_MS = 3000;
const PAGE_SIZE = 100;
const STATUS_OPTIONS = [
  ['all', 'Tüm durumlar'],
  ['READY', 'Hazır'],
  ['PENDING', 'Sırada'],
  ['PROCESSING', 'İşleniyor'],
  ['FAILED', 'Hata'],
];
const GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

/** işlenen kayıt varsa 3 sn'de bir, yoksa durur. */
export const pollWhileBusy = (query) =>
  query.state.data?.data?.some((item) => isBusy(item.status)) ? POLL_INTERVAL_MS : false;

function useReorder(type, listKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items) =>
      mediaApi.reorder(
        type,
        items.map((x) => x.id),
      ),
    onMutate: (items) =>
      queryClient.setQueryData(listKey, (page) =>
        page ? { ...page, data: items.map((x, i) => ({ ...x, sortOrder: i * 10 })) } : page,
      ),
    onSuccess: () => toast.success('Sıralama kaydedildi.'),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.media(type) }),
  });
}

function tableColumns(tab, canEdit, handlers) {
  return [
    {
      key: 'preview',
      header: 'Önizleme',
      srOnlyHeader: true,
      className: 'w-24',
      cell: (item) => (
        <ItemPreview tab={tab} item={item} className="h-12 w-20 rounded-[var(--radius-sm)]" />
      ),
    },
    {
      key: 'title',
      header: 'Başlık',
      cell: (item) => (
        <div className="max-w-64 min-w-0">
          <p className="truncate font-medium">{item.title}</p>
          <p className="text-muted-foreground type-meta truncate">{metaOf(tab, item)}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Durum', cell: (item) => <StatusBadges item={item} /> },
    {
      key: 'flags',
      header: 'Anahtarlar',
      cell: (item) => <FlagToggles tab={tab} item={item} canEdit={canEdit} compact />,
    },
    {
      key: 'actions',
      header: 'İşlemler',
      srOnlyHeader: true,
      className: 'w-12 text-right',
      cell: (item) => <ItemActions item={item} canEdit={canEdit} {...handlers} />,
    },
  ];
}

export function ContentTab({ tab, canEdit }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('grid');
  const [editing, setEditing] = useState({ open: false, item: null });
  const [deleting, setDeleting] = useState(null);
  const params = {
    q: q.trim() || undefined,
    status: status === 'all' ? undefined : status,
    pageSize: PAGE_SIZE,
  };
  const listKey = adminKeys.media(tab.type, params);
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => mediaApi.list(tab.type, params),
    placeholderData: keepPreviousData,
    refetchInterval: pollWhileBusy,
  });
  const reorder = useReorder(tab.type, listKey);
  const items = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;
  const filtered = Boolean(params.q || params.status);
  const sortable = tab.sortable && canEdit && !filtered && total <= PAGE_SIZE && view === 'grid';
  const handlers = {
    onEdit: (item) => setEditing({ open: true, item }),
    onDelete: (item) => setDeleting(item),
  };
  const addButton = canEdit && (
    <Button onClick={() => setEditing({ open: true, item: null })}>
      <Plus aria-hidden="true" />
      {tab.singular} ekle
    </Button>
  );

  return (
    <section aria-labelledby={`${tab.type}-heading`} className="grid gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h2 id={`${tab.type}-heading`} className="type-h3">
            {tab.label}
          </h2>
          <p className="text-muted-foreground text-sm">{tab.description}</p>
        </div>
        {addButton}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Başlıkta ara"
            aria-label={`${tab.label}: başlıkta ara`}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Durum filtresi">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div
          className="ml-auto flex rounded-[var(--radius-md)] border p-0.5"
          role="group"
          aria-label="Görünüm"
        >
          {[
            ['grid', LayoutGrid, 'Izgara'],
            ['table', Rows3, 'Tablo'],
          ].map(([value, Icon, label]) => (
            <Button
              key={value}
              variant={view === value ? 'secondary' : 'ghost'}
              size="icon"
              aria-pressed={view === value}
              aria-label={label}
              onClick={() => setView(value)}
            >
              <Icon aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>

      {tab.sortable && canEdit && view === 'grid' && items.length > 1 && (
        <p className="text-muted-foreground text-xs">
          {sortable
            ? 'Sıralamak için kartın sol üstündeki tutamacı sürükle ya da odaklayıp Boşluk + ok tuşlarını kullan.'
            : 'Sıralama için arama ve durum filtresini temizle.'}
        </p>
      )}

      {list.isError && <ErrorState onRetry={() => list.refetch()} />}
      {list.isPending && view === 'grid' && (
        <div className={GRID}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-[var(--radius-lg)]" />
          ))}
        </div>
      )}
      {list.isSuccess && items.length === 0 && (
        <EmptyState
          icon={ImagePlus}
          title={
            filtered ? 'Eşleşen kayıt yok' : `Henüz ${tab.label.toLocaleLowerCase('tr-TR')} yok`
          }
          description={filtered ? 'Aramayı veya filtreyi değiştir.' : tab.description}
          action={!filtered && addButton}
        />
      )}
      {items.length > 0 &&
        view === 'grid' &&
        (sortable ? (
          <SortableList
            items={items}
            layout="grid"
            className={GRID}
            aria-label={`${tab.label} sırası`}
            disabled={reorder.isPending}
            onReorder={(next) => reorder.mutate(next)}
            renderItem={(item, { handle }) => (
              <ContentCard tab={tab} item={item} canEdit={canEdit} handle={handle} {...handlers} />
            )}
          />
        ) : (
          <ul className={GRID} aria-label={tab.label}>
            {items.map((item) => (
              <li key={item.id}>
                <ContentCard tab={tab} item={item} canEdit={canEdit} {...handlers} />
              </li>
            ))}
          </ul>
        ))}
      {view === 'table' && !list.isError && (items.length > 0 || list.isPending) && (
        <DataTable
          caption={tab.label}
          columns={tableColumns(tab, canEdit, handlers)}
          rows={items}
          getRowId={(item) => item.id}
          isLoading={list.isPending}
        />
      )}
      {total > PAGE_SIZE && (
        <p className="text-muted-foreground text-xs">
          İlk {PAGE_SIZE} kayıt gösteriliyor ({total} kayıt). Aramayla daralt.
        </p>
      )}

      <ContentFormDialog
        tab={tab}
        item={editing.item}
        open={editing.open}
        onOpenChange={(open) => setEditing((s) => ({ ...s, open }))}
      />
      <DeleteDialog tab={tab} item={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}
