// CMS.md §8 — Proje / Link görselleri: salt okunur kütüphane görünümü (GET /media/assets), kullanan
// kayda bağlantı, "Kullanılmıyor" filtresiyle yetim görsellerin silinmesi. Depolama özeti de burada.
import { useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, ImageOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatBytes } from '@vasquez/shared';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
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
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { formatDateTime } from '@/lib/format.js';
import { adminKeys, mediaApi } from '../../lib/adminApi.js';
import { MediaPreview } from './MediaPreview.jsx';
import { assetMeta } from './mediaConfig.js';

const KIND_LABELS = {
  BACKGROUND: 'Arka plan',
  MUSIC_AUDIO: 'Müzik (ses)',
  MUSIC_COVER: 'Müzik kapağı',
  PROFILE: 'Profil',
  CURSOR: 'Cursor',
  PROJECT_IMAGE: 'Proje görseli',
  LINK_IMAGE: 'Link görseli',
  FAVICON: 'Favicon',
  TECH_STACK_IMAGE: 'Tech Stack görseli',
  NAME_OVERLAY: 'İsim Efekti',
  FALLING_IMAGE: 'Yağan öğe görseli',
};

const USAGE_LINKS = {
  PROJECT: (u) => `/admin/projects/${u.id}`,
  LINK: () => '/admin/links',
  TECH_STACK: () => '/admin/tech-stack',
  FALLING_ITEM: () => '/admin/hero',
};

export function StorageSummary() {
  const storage = useQuery({ queryKey: adminKeys.mediaStorage, queryFn: mediaApi.storage });
  if (!storage.isSuccess) return null;
  const { byKind, totalBytes, pendingDeletions } = storage.data;
  return (
    <section
      aria-labelledby="storage-heading"
      className="bg-card grid gap-3 rounded-[var(--radius-lg)] border p-4"
    >
      <h2 id="storage-heading" className="flex items-center gap-2 text-sm font-medium">
        <HardDrive aria-hidden="true" className="size-4" />
        Depolama · {formatBytes(totalBytes)}
      </h2>
      <dl className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3 lg:grid-cols-5">
        {byKind.map((g) => (
          <div key={g.kind} className="flex justify-between gap-2">
            <dt>{KIND_LABELS[g.kind] ?? g.kind}</dt>
            <dd className="text-foreground tabular-nums">
              {g.count} · {formatBytes(g.totalBytes)}
            </dd>
          </div>
        ))}
      </dl>
      {pendingDeletions > 0 && (
        <p className="text-muted-foreground text-xs">
          {pendingDeletions} dosya silinmeyi bekliyor.
        </p>
      )}
    </section>
  );
}

function AssetCard({ asset, tab, canEdit, onDelete }) {
  const usage = asset.usage.filter((u) => u.type === tab.usageType);
  return (
    <article className="bg-card overflow-hidden rounded-[var(--radius-lg)] border">
      <MediaPreview asset={asset} className="aspect-video w-full" />
      <div className="grid gap-2 p-3 text-sm">
        <p className="truncate font-medium" title={asset.originalFilename}>
          {asset.originalFilename}
        </p>
        <p className="text-muted-foreground type-meta">{assetMeta(asset)}</p>
        {usage.length > 0 ? (
          <p className="truncate text-xs">
            Kullanan:{' '}
            {usage.map((u) => (
              <Link
                key={u.id}
                to={USAGE_LINKS[u.type](u)}
                className="text-primary underline-offset-4 hover:underline"
              >
                {u.title}
              </Link>
            ))}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-muted-foreground">
              Kullanılmıyor
            </Badge>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(asset)}>
                <Trash2 aria-hidden="true" />
                Sil
              </Button>
            )}
          </div>
        )}
        <p className="text-muted-foreground type-meta">{formatDateTime(asset.createdAt)}</p>
      </div>
    </article>
  );
}

export function LibraryTab({ tab, canEdit }) {
  const queryClient = useQueryClient();
  const [orphan, setOrphan] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const params = { kind: tab.kind, ...(orphan && { orphan: 'true' }), limit: 48 };
  const assets = useInfiniteQuery({
    queryKey: adminKeys.mediaAssets(params),
    queryFn: ({ pageParam }) => mediaApi.assets({ ...params, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
  const remove = useMutation({
    mutationFn: (asset) => mediaApi.deleteAsset(asset.id),
    onSuccess: () => {
      toast.success('Görsel silindi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.mediaAssets() });
      queryClient.invalidateQueries({ queryKey: adminKeys.mediaStorage });
      setDeleting(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const items = assets.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <section aria-labelledby={`${tab.type}-heading`} className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id={`${tab.type}-heading`} className="type-h3">
            {tab.label}
          </h2>
          <p className="text-muted-foreground text-sm">
            Salt okunur görünüm. Görseller ilgili {tab.usageType === 'PROJECT' ? 'proje' : 'link'}{' '}
            ekranından yüklenir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id={`${tab.type}-orphan`} checked={orphan} onCheckedChange={setOrphan} />
          <Label htmlFor={`${tab.type}-orphan`}>Yalnızca kullanılmayanlar</Label>
        </div>
      </div>

      {assets.isError && <ErrorState onRetry={() => assets.refetch()} />}
      {assets.isPending && <Skeleton className="h-48 rounded-[var(--radius-lg)]" />}
      {assets.isSuccess && items.length === 0 && (
        <EmptyState
          icon={ImageOff}
          title={orphan ? 'Kullanılmayan görsel yok' : 'Henüz görsel yok'}
          description="Görseller proje ve link modülleri (F12, F13) eklenince burada listelenir."
        />
      )}
      {items.length > 0 && (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label={tab.label}
        >
          {items.map((asset) => (
            <li key={asset.id}>
              <AssetCard asset={asset} tab={tab} canEdit={canEdit} onDelete={setDeleting} />
            </li>
          ))}
        </ul>
      )}
      {assets.hasNextPage && (
        <Button
          variant="outline"
          className="justify-self-center"
          disabled={assets.isFetchingNextPage}
          onClick={() => assets.fetchNextPage()}
        >
          Daha fazla yükle
        </Button>
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanılmayan görsel silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.originalFilename}” ve tüm varyantları kalıcı olarak silinir; geri
              alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                remove.mutate(deleting);
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
