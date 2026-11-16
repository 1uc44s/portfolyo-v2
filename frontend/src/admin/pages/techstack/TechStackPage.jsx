// ADMIN.md §3.10b, FR-PUB-04B — Tech Stack: yayın anahtarı, merkez başlık (3 satır), öğeler
// (sürükle-bırak sıra = numara, görsel, etiket, açıklama, aktif). Sağda gerçek halka bileşeniyle önizleme.
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission, TECH_STACK_LIMITS } from '@vasquez/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { TechStackRing } from '@/features/techstack/TechStackRing.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SettingsCard } from '../../components/SettingsCard.jsx';
import { adminKeys, techStackApi } from '../../lib/adminApi.js';
import { FilePicker } from '../media/FilePicker.jsx';
import { MediaPreview } from '../media/MediaPreview.jsx';

const fieldErrors = (error) =>
  Object.fromEntries(
    (error?.response?.data?.error?.details ?? []).map((d) => [String(d.path), d.message]),
  );

function SettingsForm({ data, canEdit }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    published: data.published,
    titleTop: data.title.top,
    titleMain: data.title.main,
    titleBottom: data.title.bottom,
  });
  const [errors, setErrors] = useState({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.techStack });
  const save = useMutation({
    mutationFn: () => techStackApi.saveSettings(form),
    onSuccess: () => {
      setErrors({});
      toast.success('Kaydedildi.');
      refresh();
    },
    onError: (error) => {
      const e = fieldErrors(error);
      setErrors(e);
      if (e.published) toast.error(e.published);
      else if (!Object.keys(e).length) toast.error(getErrorMessage(error));
    },
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <SettingsCard
      title="Bölüm ve başlık"
      description={`Yayınlamak için en az ${TECH_STACK_LIMITS.minItems} aktif öğe gerekir. Kapalıyken sitede "Coming soon" görünür.`}
      footer={
        <SubmitButton
          type="button"
          pending={save.isPending}
          disabled={!canEdit}
          onClick={() => save.mutate()}
        >
          Kaydet
        </SubmitButton>
      }
    >
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="ts-published" className="block font-normal">
            Sitede yayınla
            <span className="text-muted-foreground block text-xs">
              Kapalıyken yalnızca başlık ve “Coming soon”.
            </span>
          </Label>
          <Switch
            id="ts-published"
            checked={form.published}
            disabled={!canEdit}
            onCheckedChange={(published) => setForm((f) => ({ ...f, published }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Üst satır (ör. 7)" error={errors.titleTop}>
            <Input
              value={form.titleTop}
              maxLength={TECH_STACK_LIMITS.titleTop}
              disabled={!canEdit}
              onChange={set('titleTop')}
            />
          </FormField>
          <FormField label="Orta satır (ör. Tech)" error={errors.titleMain}>
            <Input
              value={form.titleMain}
              maxLength={TECH_STACK_LIMITS.titleMain}
              disabled={!canEdit}
              onChange={set('titleMain')}
            />
          </FormField>
          <FormField label="Alt satır (ör. Stack)" error={errors.titleBottom}>
            <Input
              value={form.titleBottom}
              maxLength={TECH_STACK_LIMITS.titleBottom}
              disabled={!canEdit}
              onChange={set('titleBottom')}
            />
          </FormField>
        </div>
      </div>
    </SettingsCard>
  );
}

export function ItemFormDialog({ open, item, onClose }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setLabel(item?.label ?? '');
    setDescription(item?.description ?? '');
    setIsActive(item?.isActive ?? true);
    setImage(null);
    setErrors({});
  }, [open, item]);

  const save = useMutation({
    mutationFn: async () => {
      if (item) {
        await techStackApi.updateItem(item.id, { label, description, isActive });
        if (image) await techStackApi.replaceImage(item.id, image);
      } else {
        await techStackApi.createItem({ label, description, isActive, image: image ?? undefined });
      }
    },
    onSuccess: () => {
      toast.success(item ? 'Öğe güncellendi.' : 'Öğe eklendi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.techStack });
      onClose();
    },
    onError: (error) => {
      const e = fieldErrors(error);
      setErrors(e);
      if (!Object.keys(e).length) toast.error(getErrorMessage(error));
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !save.isPending && onClose()}>
      <DialogContent className="max-w-lg">
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) {
              setErrors({ label: 'Etiket zorunlu.' });
              return;
            }
            save.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>{item ? 'Öğeyi düzenle' : 'Öğe ekle'}</DialogTitle>
            <DialogDescription>
              Daire içindeki görsel, altındaki etiket ve tıklayınca açılan açıklama.
            </DialogDescription>
          </DialogHeader>
          <FilePicker
            kind="TECH_STACK_IMAGE"
            label={item?.image ? 'Görseli değiştir (opsiyonel)' : 'Görsel (opsiyonel)'}
            hint="Kare görsel; daire içine kırpılır. Yoksa baş harf gösterilir."
            file={image}
            error={errors.image}
            disabled={save.isPending}
            onChange={setImage}
          />
          <FormField label="Etiket" error={errors.label}>
            <Input
              value={label}
              maxLength={TECH_STACK_LIMITS.label}
              placeholder="React"
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormField>
          <FormField
            label="Açıklama (bununla ne yapıyorum?)"
            error={errors.description}
            description={`${description.length}/${TECH_STACK_LIMITS.description}`}
          >
            <Textarea
              rows={5}
              value={description}
              maxLength={TECH_STACK_LIMITS.description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ts-item-active" className="font-normal">
              Aktif (sitede görünür)
            </Label>
            <Switch id="ts-item-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Vazgeç
            </Button>
            <SubmitButton pending={save.isPending}>{item ? 'Kaydet' : 'Ekle'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemDialog({ item, onClose }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => techStackApi.remove(item.id),
    onSuccess: () => {
      toast.success('Öğe silindi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.techStack });
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <AlertDialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{item?.label}” silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Öğe ve görseli kalıcı olarak silinir; numaralar yeniden sıralanır.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(e) => {
              e.preventDefault();
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

const previewImage = (item) =>
  item.image ? (
    <span className="relative block size-full">
      <MediaPreview asset={item.image} alt="" />
    </span>
  ) : null;

export function TechStackPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'settings:write');
  const queryClient = useQueryClient();
  const key = adminKeys.techStack;
  const query = useQuery({ queryKey: key, queryFn: techStackApi.get });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    document.title = 'Tech Stack · Yönetim';
  }, []);

  const reorder = useMutation({
    mutationFn: (next) => techStackApi.reorder(next.map((i) => i.id)),
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
  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => techStackApi.updateItem(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const data = query.data;
  const items = data?.items ?? [];
  const full = items.length >= TECH_STACK_LIMITS.maxItems;
  const previewItems = items.filter((i) => i.isActive);

  return (
    <>
      <PageHeader
        title="Tech Stack"
        description="Ana sayfadaki halka: sıra numarayı belirler. Daireye tıklayınca açıklama açılır."
        actions={
          canEdit && (
            <Button onClick={() => setEditing({})} disabled={full}>
              <Plus aria-hidden="true" />
              Öğe ekle
            </Button>
          )
        }
      />
      {query.isPending && <Skeleton className="h-96" />}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {data && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid min-w-0 gap-6">
            <SettingsForm
              key={`${data.published}-${data.title.top}-${data.title.main}-${data.title.bottom}`}
              data={data}
              canEdit={canEdit}
            />
            <SettingsCard
              title={`Öğeler (${items.length}/${TECH_STACK_LIMITS.maxItems})`}
              description="Sürükleyerek sırala; numara rozetleri sıraya göre otomatik."
            >
              {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">Henüz öğe yok.</p>
              ) : (
                <SortableList
                  items={items}
                  aria-label="Tech Stack öğeleri"
                  disabled={!canEdit || reorder.isPending}
                  onReorder={(next) => reorder.mutate(next)}
                  className="grid gap-2"
                  renderItem={(item, { handle }) => (
                    <div className="bg-card flex min-h-16 min-w-0 items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 sm:gap-3">
                      {canEdit && (
                        <DragHandle handle={handle} label={`${item.label} sırasını değiştir`} />
                      )}
                      <span className="text-muted-foreground w-5 text-center text-sm tabular-nums">
                        {items.indexOf(item) + 1}
                      </span>
                      <span className="bg-muted relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full">
                        {item.image ? (
                          <MediaPreview asset={item.image} alt="" />
                        ) : (
                          <span className="text-sm font-semibold">{item.label.slice(0, 1)}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.label}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {item.description || 'Açıklama yok'}
                        </p>
                      </div>
                      <Switch
                        checked={item.isActive}
                        disabled={!canEdit}
                        onCheckedChange={(isActive) => toggle.mutate({ id: item.id, isActive })}
                        aria-label={`${item.label} aktif`}
                      />
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(item)}
                            aria-label={`${item.label} düzenle`}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(item)}
                            aria-label={`${item.label} sil`}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                />
              )}
            </SettingsCard>
          </div>
          <div className="grid min-w-0 gap-2 xl:sticky xl:top-24">
            <p className="type-meta text-muted-foreground">
              Önizleme {data.published ? '· yayında' : '· yayında değil'}
            </p>
            {previewItems.length > 0 ? (
              <TechStackRing title={data.title} items={previewItems} renderImage={previewImage} />
            ) : (
              <p className="text-muted-foreground text-sm">Aktif öğe yok.</p>
            )}
          </div>
        </div>
      )}
      <ItemFormDialog
        open={editing !== null}
        item={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
      />
      <DeleteItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
