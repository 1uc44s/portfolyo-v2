// kategori oluştur/düzenle modalı. Projeler ekranından ve editörden de açılır.
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CATEGORY_NAME_MAX, categoryCreateSchema } from '@my-portfolyo/shared';
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
import { Switch } from '@/components/ui/switch.jsx';
import { adminKeys, categoriesApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';

/**
 * @param {{ open: boolean, category?: object|null, onClose: () => void,
 *   onSaved?: (category: object) => void }} props
 */
export function CategoryDialog({ open, category = null, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: '', isActive: true },
  });
  const { errors, isSubmitting } = form.formState;
  const isActive = form.watch('isActive');

  useEffect(() => {
    if (open) form.reset({ name: category?.name ?? '', isActive: category?.isActive ?? true });
  }, [open, category, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = category
        ? await categoriesApi.update(category.id, values)
        : await categoriesApi.create(values);
      await queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
      toast.success(category ? 'Kategori güncellendi.' : 'Kategori oluşturuldu.');
      onSaved?.(saved);
      onClose();
    } catch (error) {
      handleFormError(error, form.setError, ['name']);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{category ? 'Kategoriyi düzenle' : 'Kategori oluştur'}</DialogTitle>
            <DialogDescription>
              Ad benzersiz olmalı; büyük/küçük harf farkı (İ/i, I/ı dahil) sayılmaz.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Ad" error={errors.name?.message}>
            <Input autoComplete="off" maxLength={CATEGORY_NAME_MAX} {...form.register('name')} />
          </FormField>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="category-active" className="block font-normal">
              Aktif
              <span className="text-muted-foreground block text-xs">
                Pasif kategori public kartlarda ve filtrede görünmez.
              </span>
            </Label>
            <Switch
              id="category-active"
              checked={isActive}
              onCheckedChange={(v) => form.setValue('isActive', v, { shouldDirty: true })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <SubmitButton pending={isSubmitting}>{category ? 'Kaydet' : 'Oluştur'}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
