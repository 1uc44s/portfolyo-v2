// "Bugünün içerikleri": dört kategori, kaynak rozeti, döngü bilgisi,
// elle değiştir (gece yarısına kadar), otomatiğe dön, yeniden seç.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, RefreshCw, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { formatDateTime } from '@/lib/format.js';
import { adminKeys, mediaApi, rotationApi } from '../lib/adminApi.js';
import { SettingsCard } from '../components/SettingsCard.jsx';

const LABELS = {
  BACKGROUND: 'Arka plan',
  MUSIC: 'Müzik',
  PFP: 'Profil fotoğrafı',
  CURSOR: 'Cursor seti',
  NAME_OVERLAY: 'İsim Efekti',
};

const SUCCESS = {
  override: 'Manuel seçim kaydedildi; gece yarısına kadar geçerli.',
  clear: 'Otomatik seçime dönüldü.',
  reselect: 'Yeni içerik seçildi.',
};

function Preview({ item }) {
  if (!item?.previewUrl) {
    return (
      <span className="bg-surface-2 text-muted-foreground grid size-16 shrink-0 place-items-center rounded-[var(--radius-md)] border">
        <ImageIcon aria-hidden="true" className="size-5" />
      </span>
    );
  }
  return (
    <img
      src={item.previewUrl}
      alt=""
      width={64}
      height={64}
      className="bg-surface-2 size-16 shrink-0 rounded-[var(--radius-md)] border object-cover"
    />
  );
}

function ContentPicker({ category, contentType, onPick, onClose }) {
  const options = useQuery({
    queryKey: adminKeys.media(contentType, { pageSize: 100 }),
    queryFn: () => mediaApi.list(contentType, { pageSize: 100 }),
  });
  const usable = (options.data?.data ?? []).filter((i) => i.isActive && i.status === 'READY');
  return (
    <Select
      defaultOpen
      onValueChange={(value) => onPick(Number(value))}
      onOpenChange={(open) => !open && onClose()}
    >
      <SelectTrigger className="w-56" aria-label={`${LABELS[category]} seç`}>
        <SelectValue placeholder={options.isPending ? 'Yükleniyor…' : 'İçerik seç'} />
      </SelectTrigger>
      <SelectContent>
        {usable.length === 0 && !options.isPending && (
          <p className="text-muted-foreground px-2 py-1.5 text-sm">Aktif içerik yok.</p>
        )}
        {usable.map((item) => (
          <SelectItem key={item.id} value={String(item.id)}>
            {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CategoryRow({ category, data, canEdit, onChange }) {
  const [choosing, setChoosing] = useState(false);
  const { today, override, cycle } = data;

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Preview item={today?.item} />
        <div className="min-w-0 space-y-1">
          <p className="type-eyebrow">{LABELS[category]}</p>
          <p className="truncate font-medium">{today?.item.title ?? 'Uygun içerik yok'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {today && (
              <Badge variant={today.source === 'MANUAL' ? 'default' : 'secondary'}>
                {today.source === 'MANUAL' ? 'Manuel' : 'Otomatik'}
              </Badge>
            )}
            <span className="type-meta text-muted-foreground">
              {override
                ? `Bitiş: ${formatDateTime(override.validUntil)}`
                : `Döngü ${cycle.number} · ${cycle.used}/${cycle.total}`}
            </span>
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {choosing ? (
            <ContentPicker
              category={category}
              contentType={data.contentType}
              onPick={(contentId) => {
                setChoosing(false);
                onChange({ kind: 'override', category, contentId });
              }}
              onClose={() => setChoosing(false)}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setChoosing(true)}>
              Değiştir
            </Button>
          )}
          {override ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ kind: 'clear', category })}>
              <Undo2 aria-hidden="true" />
              Otomatiğe dön
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${LABELS[category]} için yeniden seç`}
              title="Yeniden seç"
              disabled={cycle.total < 2}
              onClick={() => onChange({ kind: 'reselect', category })}
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function TodayContentCard({ canEdit }) {
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: adminKeys.rotation, queryFn: rotationApi.get });
  const mutation = useMutation({
    mutationFn: ({ kind, category, contentId }) => {
      if (kind === 'override') return rotationApi.setOverride(category, contentId);
      if (kind === 'clear') return rotationApi.clearOverride(category);
      return rotationApi.reselect(category);
    },
    onSuccess: (data, { kind }) => {
      queryClient.setQueryData(adminKeys.rotation, data);
      toast.success(SUCCESS[kind]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <SettingsCard
      title="Bugünün içerikleri"
      description="Her gün 00:00'da (İstanbul) dört kategori için yeni içerik seçilir. Elle değiştirdiğin seçim gece yarısına kadar geçerli kalır."
    >
      {overview.isPending && <Skeleton className="h-64 rounded-[var(--radius-md)]" />}
      {overview.isError && <ErrorState onRetry={() => overview.refetch()} />}
      {overview.isSuccess && (
        <ul className="divide-y" aria-busy={mutation.isPending}>
          {Object.entries(overview.data.categories).map(([category, data]) => (
            <CategoryRow
              key={category}
              category={category}
              data={data}
              canEdit={canEdit && !mutation.isPending}
              onChange={mutation.mutate}
            />
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
