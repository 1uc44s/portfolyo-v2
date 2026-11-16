// CMS.md §9, F5-02 — Site Ayarları › Genel: favicon yükleme (anında kaydedilir) ve varsayılana dönüş.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { DEFAULT_FAVICON, applyFavicon } from '@/app/SiteFavicon.jsx';
import { adminKeys, settingsApi } from '../lib/adminApi.js';
import { handleFormError } from '../lib/forms.js';
import { UploadField } from '../components/UploadField.jsx';

function FaviconPreview({ favicon }) {
  const src = favicon?.url ?? DEFAULT_FAVICON.href;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-2 rounded-[var(--radius-md)] border p-2">
        <img src={src} alt="" width={32} height={32} className="size-8" />
        <img src={src} alt="" width={16} height={16} className="size-4" />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="font-medium">Mevcut favicon</span>
        {favicon ? (
          <span className="text-muted-foreground type-meta">
            {favicon.mimeType === 'image/png' ? 'PNG' : 'ICO'} · {favicon.width}×{favicon.height} px
          </span>
        ) : (
          <Badge variant="secondary" className="w-fit">
            Varsayılan
          </Badge>
        )}
      </div>
    </div>
  );
}

export function FaviconSection({ settings, canEdit }) {
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);

  const apply = (data) => {
    queryClient.setQueryData(adminKeys.settings, data);
    // Public site yanıtı 30 sn HTTP önbelleğinde kalır; yeniden çekmek eski favicon'u
    // döndürebilir. Bu yüzden önbellekteki site verisi yerinde güncellenir.
    applyFavicon(data.faviconUrl);
    queryClient.setQueryData(queryKeys.site, (site) =>
      site ? { ...site, faviconUrl: data.faviconUrl } : site,
    );
  };

  const onUploaded = (response) => {
    apply(response.data);
    toast.success('Favicon güncellendi.');
    const duplicate = response.meta?.duplicateOf;
    if (duplicate) toast.info(`Bu dosya zaten yüklü: ${duplicate.title}`);
  };

  async function reset() {
    setResetting(true);
    try {
      apply(await settingsApi.clearFavicon());
      toast.success('Varsayılan favicon kullanılıyor.');
    } catch (error) {
      handleFormError(error);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FaviconPreview favicon={settings.favicon} />
        {canEdit && settings.favicon && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={resetting}>
                <RotateCcw aria-hidden="true" />
                Varsayılana dön
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Varsayılan favicon&apos;a dönülsün mü?</AlertDialogTitle>
                <AlertDialogDescription>
                  Yüklediğin favicon silinir; sekmede sitenin varsayılan simgesi görünür.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={reset}>
                  Varsayılana dön
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {canEdit && (
        <UploadField
          kind="FAVICON"
          label="Favicon yükle"
          description="ICO veya PNG · en fazla 512×512 px ve 1 MB. Önerilen: 48×48 PNG. Yükleme hemen kaydedilir."
          onUpload={(file, options) => settingsApi.uploadFavicon(file, options)}
          onUploaded={onUploaded}
        />
      )}
    </div>
  );
}
