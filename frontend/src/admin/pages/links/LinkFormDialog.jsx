// link formu: görsel (zorunlu, kare önerilir), başlık, URL (yazarken protokol
// uyarısı). Düzenlemede görsel opsiyonel: seçilirse ayrıca değiştirilir.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LINK_TITLE_MAX, linkCreateSchema } from '@my-portfolyo/shared';
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
import { adminKeys, linksApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { FilePicker } from '../media/FilePicker.jsx';

/** Yazarken uyarı: protokol yoksa ya da http/https değilse (sunucu yine reddeder). */
export function protocolHint(value) {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return 'Yalnızca http ve https bağlantıları kabul edilir.';
  return 'Adres https:// ile başlamalı.';
}

/** @param {{ open: boolean, link?: object|null, onClose: () => void }} props */
export function LinkFormDialog({ open, link = null, onClose }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [progress, setProgress] = useState(null);
  const form = useForm({
    resolver: zodResolver(linkCreateSchema),
    defaultValues: { title: '', url: '', isActive: true },
  });
  const { errors, isSubmitting } = form.formState;
  const url = useWatch({ control: form.control, name: 'url' });

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: link?.title ?? '',
      url: link?.url ?? '',
      isActive: link?.isActive ?? true,
    });
    setImage(null);
    setImageError(null);
    setProgress(null);
  }, [open, link, form]);

  const onProgress = (loaded, total) => setProgress(total ? (loaded / total) * 100 : null);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!link && !image) {
      setImageError('Görsel zorunlu.');
      return;
    }
    try {
      if (link) {
        await linksApi.update(link.id, values);
        if (image) await linksApi.replaceImage(link.id, image, { onProgress });
      } else {
        await linksApi.create({ ...values, image }, { onProgress });
      }
      await queryClient.invalidateQueries({ queryKey: adminKeys.links });
      toast.success(link ? 'Link güncellendi.' : 'Link eklendi.');
      onClose();
    } catch (error) {
      setProgress(null);
      const details = error?.response?.data?.error?.details;
      const imageIssue = Array.isArray(details) ? details.find((d) => d.path === 'image') : null;
      if (imageIssue) setImageError(imageIssue.message);
      handleFormError(error, form.setError, ['title', 'url']);
    }
  });

  const hint = protocolHint(url);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-w-lg">
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{link ? 'Linki düzenle' : 'Link ekle'}</DialogTitle>
            <DialogDescription>
              Görsel, başlık ve bağlantı zorunlu. Aynı başlık birden fazla linkte kullanılabilir.
            </DialogDescription>
          </DialogHeader>
          <FilePicker
            kind="LINK_IMAGE"
            label={link ? 'Görseli değiştir (opsiyonel)' : 'Görsel'}
            hint="Kare görsel önerilir; kartta 40×40 gösterilir."
            file={image}
            required={!link}
            error={imageError ?? undefined}
            disabled={isSubmitting}
            onChange={(file) => {
              setImage(file);
              setImageError(null);
            }}
          />
          <FormField label="Başlık" error={errors.title?.message}>
            <Input maxLength={LINK_TITLE_MAX} autoComplete="off" {...form.register('title')} />
          </FormField>
          <FormField label="Bağlantı" error={errors.url?.message} description={hint ?? undefined}>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              spellCheck={false}
              {...form.register('url')}
            />
          </FormField>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="link-active" className="block font-normal">
                  Aktif
                  <span className="text-muted-foreground block text-xs">
                    Pasif link public sayfada görünmez.
                  </span>
                </Label>
                <Switch id="link-active" checked={field.value} onCheckedChange={field.onChange} />
              </div>
            )}
          />
          {progress !== null && isSubmitting && (
            <Progress value={progress} aria-label="Görsel yükleniyor" />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Vazgeç
            </Button>
            <SubmitButton pending={isSubmitting}>{link ? 'Kaydet' : 'Ekle'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
