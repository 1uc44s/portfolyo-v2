// cursor seti formu: görsel üzerinde tıklayarak hotspot seçici + canlı deneme alanı.
// Hotspot sunucuda da görsel sınırlarıyla doğrulanır.
import { useState } from 'react';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';

const clamp = (value, max) => Math.min(Math.max(0, Math.round(value)), Math.max(0, max - 1));

/**
 * @param {{ label: string, src: string|null, size: { width: number, height: number }|null,
 *   x: number, y: number, onChange: (next: { x: number, y: number }) => void,
 *   onSize?: (size: { width: number, height: number }) => void, disabled?: boolean,
 *   errors?: { x?: string, y?: string }, idPrefix: string }} props
 */
export function HotspotPicker({
  label,
  src,
  size,
  x,
  y,
  onChange,
  onSize,
  disabled,
  errors = {},
  idPrefix,
}) {
  const scale = size ? Math.max(1, Math.floor(128 / Math.max(size.width, size.height))) : 1;

  function handleClick(event) {
    if (disabled || !size) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({
      x: clamp(((event.clientX - rect.left) / rect.width) * size.width, size.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * size.height, size.height),
    });
  }

  const numberInput = (axis, value, max) => (
    <div className="grid gap-1">
      <Label htmlFor={`${idPrefix}-${axis}`} className="text-xs">
        {axis.toUpperCase()}
      </Label>
      <Input
        id={`${idPrefix}-${axis}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max ? max - 1 : 127}
        value={value}
        disabled={disabled}
        aria-invalid={errors[axis] ? true : undefined}
        className="h-9 w-20"
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onChange({ x, y, [axis]: Number.isNaN(n) ? 0 : n });
        }}
      />
    </div>
  );

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{label} · hotspot</legend>
      <div className="flex flex-wrap items-end gap-4">
        <div className="bg-surface-2 grid size-36 place-items-center rounded-[var(--radius-md)] border bg-[repeating-conic-gradient(var(--surface-3)_0_25%,transparent_0_50%)] bg-[length:16px_16px]">
          {src ? (
            // Görsel üzerinde tıklama fare kullanıcıları için kısayol; klavye için X/Y alanları var.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
            <div
              className="relative cursor-crosshair"
              style={size ? { width: size.width * scale, height: size.height * scale } : undefined}
              onClick={handleClick}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                className="size-full [image-rendering:pixelated]"
                onLoad={(e) =>
                  onSize?.({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight,
                  })
                }
              />
              {size && (
                <span
                  aria-hidden="true"
                  className="border-primary bg-primary/30 pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                  style={{ left: (x + 0.5) * scale, top: (y + 0.5) * scale }}
                />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground px-2 text-center text-xs">Önce dosya seç</span>
          )}
        </div>
        <div className="flex gap-3">
          {numberInput('x', x, size?.width)}
          {numberInput('y', y, size?.height)}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Görsel üzerinde tıklayarak ya da X/Y alanlarından seç.
        {size && ` Görsel ${size.width}×${size.height} px.`}
      </p>
      {(errors.x || errors.y) && (
        <p className="text-danger text-xs font-medium" role="alert">
          {errors.x ?? errors.y}
        </p>
      )}
    </fieldset>
  );
}

const cursorValue = (part, fallback) =>
  part?.src ? `url("${part.src}") ${part.x} ${part.y}, ${fallback}` : fallback;

/** "İmleci burada dene": basılıyken tıklama imleci gösterilir. */
export function CursorTryArea({ normal, click }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className="bg-surface-2/50 text-muted-foreground grid min-h-28 place-items-center rounded-[var(--radius-md)] border border-dashed text-sm select-none"
      style={{ cursor: pressed ? cursorValue(click, 'pointer') : cursorValue(normal, 'auto') }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      İmleci burada dene (tıklayıp basılı tut)
    </div>
  );
}
