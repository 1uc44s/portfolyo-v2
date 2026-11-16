// F4-06 / F7 — sürükle-bırak sıralama (@dnd-kit). Fare/dokunma + klavye: tutamaca odaklan,
// Boşluk ile kaldır, ok tuşlarıyla taşı, Boşluk ile bırak, Esc ile vazgeç. Ekran okuyucu duyuruları Türkçe.
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

const position = (items, id) => items.findIndex((item) => String(item.id) === String(id)) + 1;

function announcements(items, labelOf) {
  const name = (id) => labelOf(items.find((item) => String(item.id) === String(id))) ?? 'Öğe';
  return {
    onDragStart: ({ active }) =>
      `${name(active.id)} kaldırıldı. Sıra ${position(items, active.id)} / ${items.length}. Ok tuşlarıyla taşı, Boşluk ile bırak, Esc ile vazgeç.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} şimdi ${position(items, over.id)}. sırada.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} ${position(items, over.id)}. sıraya bırakıldı.`
        : `${name(active.id)} bırakıldı.`,
    onDragCancel: ({ active }) => `Sıralama iptal edildi; ${name(active.id)} eski yerinde.`,
  };
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Sıralamak için Boşluk veya Enter ile kaldır, ok tuşlarıyla taşı, tekrar Boşluk ile bırak. Esc vazgeçer.',
};

/**
 * Sıralama tutamacı: yalnızca bu düğme sürükler (satırdaki diğer düğmeler normal çalışır).
 * @param {{ handle: object, label: string, className?: string }} props
 */
export function DragHandle({ handle, label, className }) {
  return (
    <button
      type="button"
      ref={handle.setActivatorNodeRef}
      {...handle.attributes}
      {...handle.listeners}
      aria-label={`${label} — sırala`}
      disabled={handle.disabled}
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 grid size-10 shrink-0 cursor-grab touch-none place-items-center rounded-[var(--radius-sm)] outline-none focus-visible:ring-[3px] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </button>
  );
}

function SortableItem({ item, disabled, renderItem }) {
  const sortable = useSortable({ id: item.id, disabled });
  const style = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
  };
  const handle = {
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    attributes: sortable.attributes,
    listeners: sortable.listeners,
    disabled,
  };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={cn('relative min-w-0 list-none', sortable.isDragging && 'z-10 opacity-80')}
    >
      {renderItem(item, { handle, isDragging: sortable.isDragging })}
    </li>
  );
}

/**
 * @template {{ id: string|number }} T
 * @param {{
 *   items: T[],
 *   onReorder: (next: T[], move: { from: number, to: number }) => void,
 *   renderItem: (item: T, ctx: { handle: object, isDragging: boolean }) => import('react').ReactNode,
 *   labelOf?: (item: T|undefined) => string|undefined,
 *   layout?: 'list' | 'grid',
 *   disabled?: boolean,
 *   className?: string,
 *   'aria-label'?: string,
 * }} props
 */
export function SortableList({
  items,
  onReorder,
  renderItem,
  labelOf = (item) => item?.title ?? item?.label,
  layout = 'list',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to), { from, to });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: announcements(items, labelOf),
        screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
        disabled={disabled}
      >
        <ul aria-label={ariaLabel} className={cn(layout === 'list' && 'grid gap-2', className)}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} disabled={disabled} renderItem={renderItem} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
