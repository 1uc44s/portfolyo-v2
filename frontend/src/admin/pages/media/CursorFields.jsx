// cursor formu: normal + tıklama hotspot seçicileri ve canlı deneme alanı.
// Kaynak: yeni seçilen yerel dosya ya da mevcut dosyanın yetkili önizlemesi.
import { useState } from 'react';
import { useAuthedMedia } from '../../lib/useAuthedMedia.js';
import { CursorTryArea, HotspotPicker } from './CursorTools.jsx';
import { useLocalUrl } from './FilePicker.jsx';

const SLOTS = [
  { field: 'normal', label: 'Normal imleç' },
  { field: 'click', label: 'Tıklama imleci' },
];

function useCursorSource(file, asset) {
  const local = useLocalUrl(file);
  const remote = useAuthedMedia(file ? null : asset?.previewUrl);
  const [localSize, setLocalSize] = useState(null);
  const size = file
    ? localSize
    : asset?.width
      ? { width: asset.width, height: asset.height }
      : null;
  return { src: local ?? remote.src ?? null, size, onSize: file ? setLocalSize : undefined };
}

/**
 * @param {{ item: object|null, files: Record<string, File|null>, values: Record<string, number>,
 *   errors: object, setValue: (name: string, value: number) => void }} props
 */
export function CursorFields({ item, files, values, errors, setValue }) {
  const normal = useCursorSource(files.normal, item?.files.normal);
  const click = useCursorSource(files.click, item?.files.click);
  const sources = { normal, click };

  return (
    <div className="grid gap-5 border-t pt-4">
      <div className="grid gap-5 md:grid-cols-2">
        {SLOTS.map(({ field, label }) => {
          const source = sources[field];
          return (
            <HotspotPicker
              key={field}
              idPrefix={`hotspot-${field}`}
              label={label}
              src={source.src}
              size={source.size}
              onSize={source.onSize}
              x={values[`${field}HotspotX`] ?? 0}
              y={values[`${field}HotspotY`] ?? 0}
              errors={{
                x: errors[`${field}HotspotX`]?.message,
                y: errors[`${field}HotspotY`]?.message,
              }}
              onChange={({ x, y }) => {
                setValue(`${field}HotspotX`, x);
                setValue(`${field}HotspotY`, y);
              }}
            />
          );
        })}
      </div>
      <CursorTryArea
        normal={
          normal.src && { src: normal.src, x: values.normalHotspotX, y: values.normalHotspotY }
        }
        click={click.src && { src: click.src, x: values.clickHotspotX, y: values.clickHotspotY }}
      />
    </div>
  );
}
