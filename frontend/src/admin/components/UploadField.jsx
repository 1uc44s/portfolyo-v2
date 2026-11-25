// Dosya yükleme alanı: istemci ön kontrolü (tablosu),
// byte bazlı ilerleme, iptal, aşama göstergesi (yükleniyor → işleniyor → tamam/hata).
// Sunucu doğrulaması tam zinciri yine uygular; bu bileşen yalnızca erken geri bildirim verir.
import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, Upload, X } from 'lucide-react';
import {
  acceptAttribute,
  allowedExtensions,
  formatBytes,
  precheckFile,
} from '@my-portfolyo/shared';
import { getErrorMessage } from '@/lib/api/client.js';
import { Button } from '@/components/ui/button.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { cn } from '@/lib/utils';

const isCanceled = (error) => error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError';

const STAGE_TEXT = {
  uploading: 'Yükleniyor',
  processing: 'Sunucuda işleniyor…',
  done: 'Yüklendi',
  error: 'Yüklenemedi',
  canceled: 'Yükleme iptal edildi',
};

function StatusLine({ state, percent, busy, onCancel }) {
  return (
    <div className="flex items-center gap-2">
      {busy && <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />}
      {state.stage === 'done' && (
        <CheckCircle2 aria-hidden="true" className="text-success size-4 shrink-0" />
      )}
      {state.stage === 'error' && (
        <CircleAlert aria-hidden="true" className="text-danger size-4 shrink-0" />
      )}
      <span className={cn('min-w-0 flex-1 truncate', state.stage === 'error' && 'text-danger')}>
        {STAGE_TEXT[state.stage]}
        {state.name && <span className="text-muted-foreground"> · {state.name}</span>}
      </span>
      {state.stage === 'uploading' && (
        <span className="type-meta text-muted-foreground shrink-0 tabular-nums">
          {formatBytes(state.loaded)} / {formatBytes(state.total)} · %{percent}
        </span>
      )}
      {busy && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X aria-hidden="true" />
          İptal
        </Button>
      )}
    </div>
  );
}

/**
 * @param {{
 *   kind: string,                       // MediaKind
 *   label: string,
 *   description?: string,
 *   disabled?: boolean,
 *   onUpload: (file: File, opts: { signal: AbortSignal,
 *     onProgress: (loaded: number, total: number) => void }) => Promise<unknown>,
 *   onUploaded?: (result: unknown) => void,
 *   onError?: (error: unknown) => void,
 * }} props
 */
export function UploadField({ kind, label, description, disabled, onUpload, onUploaded, onError }) {
  const id = useId();
  const inputRef = useRef(null);
  const controllerRef = useRef(null);
  const [state, setState] = useState({ stage: 'idle', loaded: 0, total: 0, name: '', message: '' });
  const [dragging, setDragging] = useState(false);
  const busy = state.stage === 'uploading' || state.stage === 'processing';

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function start(file) {
    if (!file || busy) return;
    const problem = precheckFile(kind, file);
    if (problem) {
      setState({ stage: 'error', loaded: 0, total: 0, name: file.name, message: problem });
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ stage: 'uploading', loaded: 0, total: file.size, name: file.name, message: '' });
    try {
      const result = await onUpload(file, {
        signal: controller.signal,
        onProgress: (loaded, total) =>
          setState((s) => {
            const size = total || s.total;
            return {
              ...s,
              loaded,
              total: size,
              stage: loaded >= size ? 'processing' : 'uploading',
            };
          }),
      });
      setState((s) => ({ ...s, stage: 'done', loaded: s.total }));
      onUploaded?.(result);
    } catch (error) {
      const canceled = isCanceled(error);
      setState((s) => ({
        ...s,
        stage: canceled ? 'canceled' : 'error',
        message: canceled ? '' : getErrorMessage(error, 'Dosya yüklenemedi.'),
      }));
      if (!canceled) onError?.(error);
    } finally {
      controllerRef.current = null;
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const percent = state.total ? Math.min(100, Math.round((state.loaded / state.total) * 100)) : 0;
  const hintId = `${id}-hint`;
  const statusId = `${id}-status`;
  const inactive = disabled || busy;

  return (
    <div className="grid gap-2">
      <span id={`${id}-label`} className="text-sm leading-none font-medium">
        {label}
      </span>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!inactive) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!inactive) start(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'bg-surface-2/40 flex cursor-pointer flex-col items-center gap-1 rounded-[var(--radius-md)] border border-dashed px-4 py-5 text-center transition-colors',
          'focus-within:ring-ring/50 focus-within:ring-[3px]',
          dragging && 'border-primary bg-primary/5',
          inactive && 'pointer-events-none opacity-60',
        )}
      >
        <Upload aria-hidden="true" className="text-muted-foreground size-5" />
        <span className="text-sm font-medium">Dosya seç veya buraya sürükle</span>
        <span id={hintId} className="text-muted-foreground text-xs">
          {description ?? `İzinli: ${allowedExtensions(kind).join(', ')}`}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          accept={acceptAttribute(kind)}
          disabled={inactive}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${hintId} ${statusId}`}
          onChange={(e) => start(e.target.files?.[0])}
        />
      </label>

      <div id={statusId} role="status" aria-live="polite" className="min-h-5 text-sm">
        {state.stage !== 'idle' && (
          <div className="grid gap-2">
            <StatusLine
              state={state}
              percent={percent}
              busy={busy}
              onCancel={() => controllerRef.current?.abort()}
            />
            {busy && (
              <Progress
                value={state.stage === 'processing' ? 100 : percent}
                aria-label="Yükleme ilerlemesi"
              />
            )}
            {state.message && <p className="text-danger text-xs font-medium">{state.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
