// form içi dosya seçici: istemci ön kontrolü, sürükle-bırak, yerel önizleme.
// Yükleme formun kaydıyla birlikte yapılır (UploadField'dan farkı: anında yüklemez).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FileAudio, FileVideo, Upload, X } from 'lucide-react';
import { acceptAttribute, formatBytes, precheckFile } from '@my-portfolyo/shared';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

/** Yerel dosyanın object URL'i (bileşen kapanınca serbest bırakılır). */
export function useLocalUrl(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return url;
}

function LocalPreview({ file, url }) {
  if (file.type.startsWith('image/') || /\.(cur|ico)$/i.test(file.name)) {
    return (
      <img
        src={url}
        alt=""
        className="size-12 shrink-0 rounded-[var(--radius-sm)] object-contain"
      />
    );
  }
  const Icon = file.type.startsWith('audio/') ? FileAudio : FileVideo;
  return <Icon aria-hidden="true" className="text-muted-foreground size-8 shrink-0" />;
}

/**
 * @param {{ kind: string, label: string, hint?: string, file: File|null, required?: boolean,
 *   error?: string, disabled?: boolean, onChange: (file: File|null) => void }} props
 */
export function FilePicker({ kind, label, hint, file, required, error, disabled, onChange }) {
  const id = useId();
  const inputRef = useRef(null);
  const [problem, setProblem] = useState(null);
  const [dragging, setDragging] = useState(false);
  const url = useLocalUrl(file);
  const message = problem ?? error;

  function pick(next) {
    if (!next) return;
    const issue = precheckFile(kind, next);
    setProblem(issue);
    onChange(issue ? null : next);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="grid min-w-0 gap-2">
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
        {required && <span className="text-muted-foreground font-normal"> (zorunlu)</span>}
      </span>
      {file ? (
        <div className="flex min-w-0 items-center gap-3 overflow-hidden rounded-[var(--radius-md)] border p-2">
          <LocalPreview file={file} url={url} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="text-muted-foreground type-meta">{formatBytes(file.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="shrink-0"
            aria-label={`${label}: seçimi kaldır`}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'bg-surface-2/40 flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-md)] border border-dashed px-4 py-4 text-center break-words transition-colors',
            'focus-within:ring-ring/50 focus-within:ring-[3px]',
            dragging && 'border-primary bg-primary/5',
            message && 'border-danger/60',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          <Upload aria-hidden="true" className="text-muted-foreground size-5" />
          <span className="text-sm font-medium">Dosya seç veya buraya sürükle</span>
          {hint && (
            <span id={`${id}-hint`} className="text-muted-foreground text-xs">
              {hint}
            </span>
          )}
          <input
            ref={inputRef}
            id={id}
            type="file"
            className="sr-only"
            accept={acceptAttribute(kind)}
            disabled={disabled}
            aria-labelledby={`${id}-label`}
            aria-describedby={cn(hint && `${id}-hint`, message && `${id}-error`) || undefined}
            aria-invalid={message ? true : undefined}
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      )}
      {message && (
        <p id={`${id}-error`} className="text-danger text-xs font-medium" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
