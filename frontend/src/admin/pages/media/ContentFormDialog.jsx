// içerik oluşturma/düzenleme diyaloğu. Oluşturmada tüm dosya yuvaları zorunlu (müzik:
// MP3 + kapak, cursor: normal + tıklama); düzenlemede alanlar PATCH, yeni dosya PUT /:id/file ile gider.
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { HOTSPOT_FIELDS, mediaCreateSchema } from '@my-portfolyo/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
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
import { Progress } from '@/components/ui/progress.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { adminKeys, mediaApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { CursorFields } from './CursorFields.jsx';
import { FilePicker } from './FilePicker.jsx';
import { MiniAudioPlayer } from './MediaPreview.jsx';
import { FLAG_LABELS, assetMeta } from './mediaConfig.js';

const isCanceled = (error) => error?.code === 'ERR_CANCELED';

// Yeni kayıtta kapalı başlayan anahtarlar (geri kalanı açık).
const OFF_BY_DEFAULT = new Set(['isDownloadable', 'isWallpaper']);

function defaultsOf(tab, item) {
  const values = { title: item?.title ?? '' };
  for (const flag of tab.flags) values[flag] = item ? item[flag] : !OFF_BY_DEFAULT.has(flag);
  if (tab.type === 'musics') values.artist = item?.artist ?? '';
  if (tab.type === 'cursors') for (const f of HOTSPOT_FIELDS) values[f] = item?.[f] ?? 0;
  return values;
}

function FlagSwitches({ tab, control }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tab.flags.map((flag) => (
        <Controller
          key={flag}
          control={control}
          name={flag}
          render={({ field }) => (
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border p-3">
              <Switch
                id={`flag-${flag}`}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={`flag-${flag}-hint`}
              />
              <div className="grid gap-0.5">
                <Label htmlFor={`flag-${flag}`}>{FLAG_LABELS[flag].label}</Label>
                <span id={`flag-${flag}-hint`} className="text-muted-foreground text-xs">
                  {FLAG_LABELS[flag].hint}
                </span>
              </div>
            </div>
          )}
        />
      ))}
    </div>
  );
}

/** @param {{ tab: object, item: object|null, onClose: () => void }} props */
function ContentForm({ tab, item, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);
  const form = useForm({
    resolver: zodResolver(mediaCreateSchema(tab.type)),
    defaultValues: defaultsOf(tab, item),
  });
  const [files, setFiles] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [progress, setProgress] = useState(null);
  const controllerRef = useRef(null);
  const { errors, isSubmitting, dirtyFields } = form.formState;
  const values = useWatch({ control: form.control });
  const chosen = tab.slots.filter((s) => files[s.field]);

  const setFile = (field, file) => {
    setFiles((f) => ({ ...f, [field]: file }));
    setFileErrors((e) => ({ ...e, [field]: undefined }));
  };

  function missingFiles() {
    const needAll = !isEdit || (tab.replaceAll && chosen.length > 0);
    const missing = needAll ? tab.slots.filter((s) => !files[s.field]) : [];
    if (missing.length === 0) return false;
    const text =
      tab.slots.length > 1
        ? `${tab.slots.map((s) => s.label).join(' ve ')} birlikte zorunlu.`
        : 'Dosya seç.';
    setFileErrors(Object.fromEntries(missing.map((s) => [s.field, text])));
    return true;
  }

  function applyError(error) {
    const details = error?.response?.data?.error?.details;
    const slotFields = tab.slots.map((s) => s.field);
    if (Array.isArray(details)) {
      setFileErrors(
        Object.fromEntries(
          details.filter((d) => slotFields.includes(d.path)).map((d) => [d.path, d.message]),
        ),
      );
    }
    handleFormError(error, form.setError, [...slotFields, ...Object.keys(defaultsOf(tab, null))]);
  }

  const onSubmit = form.handleSubmit(async (input) => {
    if (missingFiles()) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const upload = {
      signal: controller.signal,
      onProgress: (loaded, total) => setProgress(total ? Math.round((loaded / total) * 100) : 0),
    };
    try {
      let saved;
      let duplicates = [];
      if (!isEdit) {
        setProgress(0);
        const res = await mediaApi.create(tab.type, { files, fields: input }, upload);
        ({ data: saved } = res);
        duplicates = res.meta?.duplicates ?? [];
      } else {
        const dirty = Object.keys(dirtyFields).filter((k) => dirtyFields[k]);
        const hotspots = tab.type === 'cursors' && chosen.length ? HOTSPOT_FIELDS : [];
        if (chosen.length > 0) {
          setProgress(0);
          const fields = Object.fromEntries(hotspots.map((f) => [f, input[f]]));
          const res = await mediaApi.replaceFiles(tab.type, item.id, { files, fields }, upload);
          ({ data: saved } = res);
          duplicates = res.meta?.duplicates ?? [];
        }
        const rest = dirty.filter((k) => !hotspots.includes(k));
        if (rest.length > 0) {
          saved = await mediaApi.update(
            tab.type,
            item.id,
            Object.fromEntries(rest.map((k) => [k, input[k]])),
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: adminKeys.media(tab.type) });
      queryClient.invalidateQueries({ queryKey: adminKeys.mediaStorage });
      toast.success(isEdit ? `${tab.singular} kaydedildi.` : `${tab.singular} eklendi.`);
      if (saved && saved.status !== 'READY')
        toast.info('Video sırada; işlenince otomatik güncellenir.');
      for (const d of duplicates) toast.info(`Bu dosya zaten yüklü: ${d.title}`);
      onClose();
    } catch (error) {
      if (isCanceled(error)) toast.info('Yükleme iptal edildi.');
      else applyError(error);
    } finally {
      controllerRef.current = null;
      setProgress(null);
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid min-w-0 gap-5">
      <fieldset disabled={isSubmitting} className="grid min-w-0 gap-5">
        <FormField label="Başlık" error={errors.title?.message}>
          <Input maxLength={120} autoComplete="off" {...form.register('title')} />
        </FormField>
        {tab.type === 'musics' && (
          <FormField label="Sanatçı" description="Opsiyonel." error={errors.artist?.message}>
            <Input maxLength={120} autoComplete="off" {...form.register('artist')} />
          </FormField>
        )}
        <FlagSwitches tab={tab} control={form.control} />

        {isEdit && (
          <div className="grid gap-2 border-t pt-4">
            <p className="text-sm font-medium">Mevcut dosya</p>
            {tab.slots.map((s) => (
              <p key={s.field} className="text-muted-foreground type-meta break-all">
                {s.label}: {item.files[s.field].originalFilename} · {assetMeta(item.files[s.field])}
              </p>
            ))}
            {tab.type === 'musics' && (
              <MiniAudioPlayer asset={item.files.audio} title={item.title} />
            )}
            <p className="text-muted-foreground text-xs">
              {tab.replaceAll && tab.slots.length > 1
                ? 'Değiştirmek için iki dosyayı birlikte seç.'
                : 'Değiştirmek istediğin dosyayı seç; boş bırakırsan dosya aynı kalır.'}
            </p>
          </div>
        )}
        <div
          className={
            tab.slots.length > 1
              ? 'grid gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]'
              : 'grid gap-4'
          }
        >
          {tab.slots.map((s) => (
            <FilePicker
              key={s.field}
              kind={s.kind}
              label={isEdit ? `Yeni ${s.label.toLocaleLowerCase('tr-TR')}` : s.label}
              hint={s.hint}
              required={!isEdit}
              file={files[s.field] ?? null}
              error={fileErrors[s.field]}
              onChange={(file) => setFile(s.field, file)}
            />
          ))}
        </div>
        {tab.type === 'cursors' && (
          <CursorFields
            item={item}
            files={files}
            values={values}
            errors={errors}
            setValue={(name, value) => form.setValue(name, value, { shouldDirty: true })}
          />
        )}
      </fieldset>

      {progress !== null && (
        <div className="grid gap-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span>{progress >= 100 ? 'Sunucuda işleniyor…' : `Yükleniyor %${progress}`}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => controllerRef.current?.abort()}
            >
              İptal
            </Button>
          </div>
          <Progress value={progress} aria-label="Yükleme ilerlemesi" />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Vazgeç
        </Button>
        <SubmitButton pending={isSubmitting} pendingLabel="Kaydediliyor…">
          {isEdit ? 'Kaydet' : 'Ekle'}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

/** @param {{ tab: object, item: object|null, open: boolean, onOpenChange: (open: boolean) => void }} props */
export function ContentFormDialog({ tab, item, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? `${tab.singular} düzenle` : `${tab.singular} ekle`}</DialogTitle>
          <DialogDescription>{tab.description}</DialogDescription>
        </DialogHeader>
        {open && (
          <ContentForm
            key={item?.id ?? 'new'}
            tab={tab}
            item={item}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
