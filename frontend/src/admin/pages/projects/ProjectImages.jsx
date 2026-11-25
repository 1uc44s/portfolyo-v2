// Çoklu görsel: sürükle-bırak alanı, dosya başına ilerleme, sıralama (ilk = kapak),
// alt metin (boşsa başlık kullanılır), silme. Her dosya ayrı istekle yüklenir (bağımsız ilerleme).
import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { acceptAttribute, PROJECT_IMAGE_ALT_MAX, precheckFile } from '@my-portfolyo/shared';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { cn } from '@/lib/utils';
import { adminKeys, projectsApi } from '../../lib/adminApi.js';
import { MediaPreview } from '../media/MediaPreview.jsx';

const KIND = 'PROJECT_IMAGE';

function AltInput({ image, projectTitle, disabled, onSave }) {
  const [value, setValue] = useState(image.alt ?? '');
  return (
    <Input
      value={value}
      maxLength={PROJECT_IMAGE_ALT_MAX}
      disabled={disabled}
      placeholder={projectTitle || 'Alt metin'}
      aria-label="Alt metin"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if ((image.alt ?? '') !== value.trim()) onSave(value.trim() || null);
      }}
      className="h-8 text-xs"
    />
  );
}

/** @param {{ project: object, canEdit: boolean }} props */
export function ProjectImages({ project, canEdit }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [uploads, setUploads] = useState([]); // { key, name, progress, error }
  const [dragOver, setDragOver] = useState(false);
  const key = adminKeys.project(project.id);
  const setProject = (next) => {
    queryClient.setQueryData(key, next);
    queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
  };

  const reorder = useMutation({
    mutationFn: (next) =>
      projectsApi.reorderImages(
        project.id,
        next.map((i) => i.id),
      ),
    onMutate: (next) => {
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, { ...project, images: next });
      return { previous };
    },
    onSuccess: setProject,
    onError: (error, _n, ctx) => {
      queryClient.setQueryData(key, ctx?.previous);
      toast.error(getErrorMessage(error));
    },
  });
  const updateAlt = useMutation({
    mutationFn: ({ imageId, alt }) => projectsApi.updateImage(project.id, imageId, { alt }),
    onSuccess: (next) => {
      setProject(next);
      toast.success('Alt metin kaydedildi.');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (imageId) => projectsApi.removeImage(project.id, imageId),
    onSuccess: (next) => {
      setProject(next);
      toast.success('Görsel silindi.');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  async function uploadAll(fileList) {
    const files = Array.from(fileList ?? []);
    for (const [index, file] of files.entries()) {
      const uploadKey = `${Date.now()}-${index}-${file.name}`;
      const problem = precheckFile(KIND, file);
      setUploads((list) => [
        ...list,
        { key: uploadKey, name: file.name, progress: 0, error: problem },
      ]);
      if (problem) continue;
      try {
        const res = await projectsApi.addImage(project.id, file, {
          onProgress: (loaded, total) =>
            setUploads((list) =>
              list.map((u) =>
                u.key === uploadKey ? { ...u, progress: total ? (loaded / total) * 100 : 0 } : u,
              ),
            ),
        });
        setProject(res.data);
        if (res.meta?.duplicates?.length) toast.warning(`${file.name} kütüphanede zaten var.`);
        setUploads((list) => list.filter((u) => u.key !== uploadKey));
      } catch (error) {
        setUploads((list) =>
          list.map((u) => (u.key === uploadKey ? { ...u, error: getErrorMessage(error) } : u)),
        );
      }
    }
  }

  const { images } = project;

  return (
    <div className="grid gap-4">
      {canEdit && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            uploadAll(e.dataTransfer.files);
          }}
          className={cn(
            'focus-within:ring-ring/50 hover:bg-accent/40 flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-lg)] border border-dashed px-6 py-8 text-center transition-colors focus-within:ring-[3px]',
            dragOver && 'border-primary bg-primary/5',
          )}
        >
          <ImagePlus aria-hidden="true" className="text-muted-foreground size-6" />
          <span className="text-sm font-medium">Görselleri sürükle ya da seç</span>
          <span className="text-muted-foreground text-xs">
            JPG, PNG, WebP, GIF · ilk görsel kartın kapağı olur
          </span>
          <input
            id={inputId}
            type="file"
            multiple
            accept={acceptAttribute(KIND)}
            className="sr-only"
            onChange={(e) => {
              uploadAll(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {uploads.length > 0 && (
        <ul className="grid gap-2" aria-label="Yüklenen dosyalar">
          {uploads.map((u) => (
            <li key={u.key} className="grid gap-1 rounded-[var(--radius-md)] border px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{u.name}</span>
                {u.error ? (
                  <button
                    type="button"
                    className="text-muted-foreground text-xs underline"
                    onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                  >
                    Kapat
                  </button>
                ) : (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                )}
              </div>
              {u.error ? (
                <p role="alert" className="text-danger text-xs">
                  {u.error}
                </p>
              ) : (
                <Progress value={u.progress} aria-label={`${u.name} yükleniyor`} />
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Henüz görsel yok. İlk görsel kartın kapağı olur.
        </p>
      ) : (
        <SortableList
          items={images}
          layout="grid"
          aria-label="Proje görselleri"
          labelOf={(img) => img?.alt || 'Görsel'}
          disabled={!canEdit || reorder.isPending}
          onReorder={(next) => reorder.mutate(next)}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          renderItem={(image, { handle }) => (
            <div className="bg-card grid gap-2 rounded-[var(--radius-md)] border p-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-sm)]">
                <MediaPreview asset={image.asset} alt={image.alt ?? ''} />
                {images[0].id === image.id && (
                  <Badge className="absolute top-1.5 left-1.5">Kapak</Badge>
                )}
              </div>
              <AltInput
                image={image}
                projectTitle={project.title}
                disabled={!canEdit}
                onSave={(alt) => updateAlt.mutate({ imageId: image.id, alt })}
              />
              {canEdit && (
                <div className="flex items-center justify-between">
                  <DragHandle handle={handle} label="Görselin sırasını değiştir" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(image.id)}
                    aria-label="Görseli sil"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}
