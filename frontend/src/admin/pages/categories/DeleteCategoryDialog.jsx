// kullanılmayan kategori doğrudan silinir; kullanımdaysa ya başka
// kategoriye taşınır ya da ilişkiler kaldırılarak silinir (yayındaki kategorisiz projeler uyarılır).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { adminKeys, categoriesApi } from '../../lib/adminApi.js';

const NONE = 'none';

/** @param {{ category: object|null, categories: object[], onClose: () => void }} props */
export function DeleteCategoryDialog({ category, categories, onClose }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState(NONE);
  const inUse = (category?.projectCount ?? 0) > 0;
  const others = categories.filter((c) => c.id !== category?.id);

  const remove = useMutation({
    mutationFn: async () => {
      if (!inUse) {
        await categoriesApi.remove(category.id);
        return { uncategorizedPublished: [] };
      }
      return categoriesApi.reassignAndDelete(category.id, target === NONE ? null : Number(target));
    },
    onSuccess: (result) => {
      toast.success('Kategori silindi.');
      const orphans = result?.uncategorizedPublished ?? [];
      if (orphans.length > 0) {
        toast.warning(
          `Kategorisiz kalan yayındaki projeler: ${orphans.map((p) => p.title).join(', ')}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
      setTarget(NONE);
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <AlertDialog open={Boolean(category)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{category?.name}” silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            {inUse
              ? `Bu kategori ${category.projectCount} projede kullanılıyor. Projeleri başka bir kategoriye taşıyabilir ya da yalnızca bu kategoriyi projelerden kaldırabilirsin.`
              : 'Kategori kalıcı olarak silinir; bu işlem geri alınamaz.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {inUse && (
          <div className="grid gap-2">
            <label htmlFor="reassign-target" className="text-sm font-medium">
              Projeler ne olsun?
            </label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id="reassign-target" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Kategoriyi projelerden kaldır</SelectItem>
                {others.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    “{c.name}” kategorisine taşı
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate();
            }}
          >
            {remove.isPending ? 'Siliniyor…' : inUse ? 'Uygula ve sil' : 'Sil'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
