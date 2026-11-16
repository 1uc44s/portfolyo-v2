// DATABASE.md §5.2 — içerik silme onayı: kayıt + dosyaları kalıcı silinir (geri alınamaz).
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
import { getErrorMessage } from '@/lib/api/client.js';
import { adminKeys, mediaApi } from '../../lib/adminApi.js';

const EXTRA = {
  pfps: 'Hero bölümünde sabit profil olarak seçiliyse hero günlük rotasyona döner.',
  musics: 'MP3 ve kapak birlikte silinir.',
  cursors: 'Normal ve tıklama imleci birlikte silinir.',
};

/** @param {{ tab: object, item: object|null, onClose: () => void }} props */
export function DeleteDialog({ tab, item, onClose }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => mediaApi.remove(tab.type, item.id),
    onSuccess: () => {
      toast.success(`${tab.singular} silindi.`);
      queryClient.invalidateQueries({ queryKey: adminKeys.media(tab.type) });
      queryClient.invalidateQueries({ queryKey: adminKeys.mediaStorage });
      if (tab.type === 'pfps') queryClient.invalidateQueries({ queryKey: adminKeys.hero });
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <AlertDialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>“{item?.title}” silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            Kayıt ve dosyaları kalıcı olarak silinir; bu işlem geri alınamaz.{' '}
            {EXTRA[tab.type] ?? ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            {remove.isPending ? 'Siliniyor…' : 'Sil'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
