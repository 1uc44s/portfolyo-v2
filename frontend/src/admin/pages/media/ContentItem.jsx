// CMS.md §8 — içerik kartı (ızgara) ve tablo hücreleri: önizleme, başlık, meta, rozetler,
// aktif/indirilebilir/rotasyon anahtarları, Düzenle/Sil menüsü, sıralama tutamacı.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DragHandle } from '@/components/common/SortableList.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { formatDateTime } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { adminKeys, mediaApi } from '../../lib/adminApi.js';
import { MediaPreview, MiniAudioPlayer, StatusBadges } from './MediaPreview.jsx';
import { FLAG_LABELS, assetMeta } from './mediaConfig.js';

/** Liste önbelleğindeki kaydı yerinde günceller (tüm filtre varyantları). */
export function patchCachedItem(queryClient, type, next) {
  queryClient.setQueriesData({ queryKey: adminKeys.media(type) }, (page) =>
    page?.data
      ? { ...page, data: page.data.map((x) => (x.id === next.id ? { ...x, ...next } : x)) }
      : page,
  );
}

export function FlagToggles({ tab, item, canEdit, compact = false }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ flag, value }) => mediaApi.update(tab.type, item.id, { [flag]: value }),
    onMutate: ({ flag, value }) =>
      patchCachedItem(queryClient, tab.type, { id: item.id, [flag]: value }),
    onSuccess: (saved) => patchCachedItem(queryClient, tab.type, saved),
    onError: (error) => {
      toast.error(getErrorMessage(error));
      queryClient.invalidateQueries({ queryKey: adminKeys.media(tab.type) });
    },
  });
  return (
    <div className={cn('flex flex-wrap gap-x-4 gap-y-2', compact && 'gap-x-3')}>
      {tab.flags.map((flag) => {
        const id = `${tab.type}-${item.id}-${flag}`;
        return (
          <div key={flag} className="flex items-center gap-2">
            <Switch
              id={id}
              size="sm"
              checked={item[flag]}
              disabled={!canEdit || mutation.isPending}
              onCheckedChange={(value) => mutation.mutate({ flag, value })}
            />
            <label htmlFor={id} className="text-muted-foreground text-xs">
              {FLAG_LABELS[flag].label}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function ItemActions({ item, canEdit, onEdit, onDelete }) {
  if (!canEdit) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${item.title}: işlemler`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(item)}>
          <Pencil aria-hidden="true" />
          Düzenle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
          <Trash2 aria-hidden="true" />
          Sil
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Kart/tablo önizlemesi: cursor'da iki imleç yan yana, müzikte kapak. */
export function ItemPreview({ tab, item, className }) {
  if (tab.type === 'cursors') {
    return (
      <div className={cn('grid grid-cols-2 gap-px', className)}>
        <MediaPreview asset={item.files.normal} alt="Normal imleç" fit="contain" className="p-3" />
        <MediaPreview asset={item.files.click} alt="Tıklama imleci" fit="contain" className="p-3" />
      </div>
    );
  }
  const asset = tab.type === 'musics' ? item.files.cover : item.files.file;
  return <MediaPreview asset={asset} alt="" className={className} />;
}

export const metaOf = (tab, item) =>
  tab.type === 'musics'
    ? [item.artist, assetMeta(item.files.audio)].filter(Boolean).join(' · ')
    : tab.type === 'cursors'
      ? `${assetMeta(item.files.normal)} / ${assetMeta(item.files.click)}`
      : assetMeta(item.files.file);

export function ContentCard({ tab, item, canEdit, handle, onEdit, onDelete }) {
  return (
    <article className="bg-card flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border">
      <div className="relative">
        <ItemPreview tab={tab} item={item} className={cn('w-full', tab.aspect)} />
        {handle && (
          <DragHandle
            handle={handle}
            label={item.title}
            className="bg-background/85 absolute top-2 left-2 backdrop-blur"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium" title={item.title}>
              {item.title}
            </h3>
            <p className="text-muted-foreground type-meta truncate">{metaOf(tab, item)}</p>
          </div>
          <ItemActions item={item} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
        </div>
        <StatusBadges item={item} />
        {item.status === 'FAILED' && (
          <p className="text-danger text-xs">
            {Object.values(item.files).find((a) => a.processingError)?.processingError ??
              'Dosya işlenemedi.'}
          </p>
        )}
        {tab.type === 'musics' && <MiniAudioPlayer asset={item.files.audio} title={item.title} />}
        <div className="mt-auto grid gap-3 border-t pt-3">
          <FlagToggles tab={tab} item={item} canEdit={canEdit} />
          <span className="text-muted-foreground type-meta">
            Eklendi {formatDateTime(item.createdAt)}
          </span>
        </div>
      </div>
    </article>
  );
}
