// ADMIN.md §3.5, SRS FR-FALL-01 — Hero Section altındaki "Yağan öğeler" kartı: görsel veya metin
// (emoji/harf/sayı) öğe ekle, düzenle (metin, boyut, aktif), görsel değiştir, sırala, sil.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FALLING_LIMITS } from '@vasquez/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { cn } from '@/lib/utils';
import { SettingsCard } from '../components/SettingsCard.jsx';
import { adminKeys, fallingApi } from '../lib/adminApi.js';
import { FilePicker } from './media/FilePicker.jsx';
import { MediaPreview } from './media/MediaPreview.jsx';

const KINDS = [
  { value: 'TEXT', label: 'Metin / emoji' },
  { value: 'IMAGE', label: 'Görsel' },
];

const fieldErrors = (error) =>
  Object.fromEntries(
    (error?.response?.data?.error?.details ?? []).map((d) => [String(d.path), d.message]),
  );

function AddForm({ disabled, onDone }) {
  const [kind, setKind] = useState('TEXT');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [size, setSize] = useState(String(FALLING_LIMITS.defaultSize));
  const [errors, setErrors] = useState({});
  const create = useMutation({
    mutationFn: () =>
      fallingApi.create(
        kind === 'TEXT' ? { kind, text, size } : { kind, size, image: file ?? undefined },
      ),
    onSuccess: () => {
      toast.success('Öğe eklendi.');
      setText('');
      setFile(null);
      setErrors({});
      onDone();
    },
    onError: (error) => {
      const e = fieldErrors(error);
      setErrors(e);
      if (!Object.keys(e).length) toast.error(getErrorMessage(error));
    },
  });

  return (
    <form
      className="grid gap-4 rounded-[var(--radius-md)] border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div role="radiogroup" aria-label="Öğe türü" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            disabled={disabled}
            onClick={() => setKind(k.value)}
            className={cn(
              'min-h-9 rounded-full border px-4 text-sm transition-colors',
              kind === k.value
                ? 'bg-primary text-primary-foreground border-transparent'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        {kind === 'TEXT' ? (
          <FormField
            label="Metin"
            error={errors.text}
            description={`Emoji, harf veya sayı; en fazla ${FALLING_LIMITS.maxText} karakter.`}
          >
            <Input
              value={text}
              maxLength={16}
              placeholder="❄️"
              disabled={disabled}
              onChange={(e) => setText(e.target.value)}
            />
          </FormField>
        ) : (
          <FilePicker
            kind="FALLING_IMAGE"
            label="Görsel"
            hint="PNG, WEBP veya GIF · en fazla 1 MB. Şeffaf zemin önerilir; 256 px'e küçültülür."
            file={file}
            required
            error={errors.image}
            disabled={disabled}
            onChange={setFile}
          />
        )}
        <FormField label="Boyut (px)" error={errors.size}>
          <Input
            type="number"
            inputMode="numeric"
            min={FALLING_LIMITS.minSize}
            max={FALLING_LIMITS.maxSize}
            value={size}
            disabled={disabled}
            onChange={(e) => setSize(e.target.value)}
          />
        </FormField>
      </div>
      <Button type="submit" className="w-fit" disabled={disabled || create.isPending}>
        <Plus aria-hidden="true" />
        Ekle
      </Button>
    </form>
  );
}

function ItemRow({ item, handle, canEdit, onChanged, onDelete }) {
  const [text, setText] = useState(item.text ?? '');
  const [size, setSize] = useState(String(item.size));
  const update = useMutation({
    mutationFn: (body) => fallingApi.update(item.id, body),
    onSuccess: onChanged,
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const replace = useMutation({
    mutationFn: (file) => fallingApi.replaceImage(item.id, file),
    onSuccess: () => {
      toast.success('Görsel değiştirildi.');
      onChanged();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const label = item.kind === 'TEXT' ? `Metin ${item.text}` : 'Görsel öğe';
  const commit = () => {
    const body = {};
    if (item.kind === 'TEXT' && text.trim() && text !== item.text) body.text = text;
    if (Number(size) !== item.size) body.size = Number(size);
    if (Object.keys(body).length) update.mutate(body);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
      {canEdit && <DragHandle handle={handle} label={label} />}
      <span className="bg-muted grid size-12 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)] text-2xl">
        {item.kind === 'IMAGE' && item.image ? (
          <MediaPreview asset={item.image} fit="contain" className="size-10" />
        ) : (
          <span aria-hidden="true">{item.text}</span>
        )}
      </span>
      {item.kind === 'TEXT' ? (
        <Input
          aria-label="Metin"
          value={text}
          maxLength={16}
          disabled={!canEdit}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          className="min-w-24 flex-1"
        />
      ) : (
        <label className="text-muted-foreground min-w-24 flex-1 text-sm">
          <span className="sr-only">Görseli değiştir</span>
          <input
            type="file"
            accept="image/png,image/webp,image/gif"
            disabled={!canEdit || replace.isPending}
            onChange={(e) => e.target.files?.[0] && replace.mutate(e.target.files[0])}
            className="file:bg-muted max-w-full text-xs file:mr-2 file:rounded-[var(--radius-sm)] file:border-0 file:px-2 file:py-1"
          />
        </label>
      )}
      <Input
        aria-label="Boyut (px)"
        type="number"
        min={FALLING_LIMITS.minSize}
        max={FALLING_LIMITS.maxSize}
        value={size}
        disabled={!canEdit}
        onChange={(e) => setSize(e.target.value)}
        onBlur={commit}
        className="w-20"
      />
      <Switch
        aria-label="Aktif"
        checked={item.isActive}
        disabled={!canEdit || update.isPending}
        onCheckedChange={(isActive) => update.mutate({ isActive })}
      />
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${label} sil`}
          className="text-muted-foreground hover:text-danger"
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function FallingItemsCard({ canEdit }) {
  const queryClient = useQueryClient();
  const key = adminKeys.falling;
  const query = useQuery({ queryKey: key, queryFn: fallingApi.list });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const reorder = useMutation({
    mutationFn: (next) => fallingApi.reorder(next.map((i) => i.id)),
    onMutate: (next) => {
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, { ...previous, items: next });
      return { previous };
    },
    onError: (error, _v, ctx) => {
      queryClient.setQueryData(key, ctx?.previous);
      toast.error(getErrorMessage(error));
    },
  });
  const remove = useMutation({
    mutationFn: (id) => fallingApi.remove(id),
    onSuccess: () => {
      toast.success('Öğe silindi.');
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const items = query.data?.items ?? [];
  const full = items.length >= FALLING_LIMITS.maxItems;

  return (
    <SettingsCard
      title="Yağan öğeler"
      description={`Sitede yukarıdan aşağı yağan görseller veya emoji/harf/sayılar. Aktif olanların hepsi birlikte yağar (en fazla ${FALLING_LIMITS.maxItems} öğe). Düşük efekt modunda ve azaltılmış harekette gösterilmez.`}
    >
      {query.isPending && <Skeleton className="h-32 rounded-[var(--radius-md)]" />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.isSuccess && (
        <div className="grid gap-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Henüz öğe yok; aşağıdan ekleyebilirsin.</p>
          ) : (
            <SortableList
              items={items}
              aria-label="Yağan öğeler sırası"
              className="gap-3"
              disabled={!canEdit}
              labelOf={(item) => (item.kind === 'TEXT' ? `Metin ${item.text}` : 'Görsel öğe')}
              onReorder={(next) => reorder.mutate(next)}
              renderItem={(item, { handle }) => (
                <ItemRow
                  key={`${item.id}-${item.text}-${item.size}`}
                  item={item}
                  handle={handle}
                  canEdit={canEdit}
                  onChanged={refresh}
                  onDelete={() => remove.mutate(item.id)}
                />
              )}
            />
          )}
          {canEdit &&
            (full ? (
              <p className="text-muted-foreground text-sm">
                En fazla {FALLING_LIMITS.maxItems} öğe eklenebilir.
              </p>
            ) : (
              <AddForm disabled={!canEdit} onDone={refresh} />
            ))}
        </div>
      )}
    </SettingsCard>
  );
}
