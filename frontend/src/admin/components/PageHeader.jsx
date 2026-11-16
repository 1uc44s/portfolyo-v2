// Sayfa başlığı ve henüz hazır olmayan modüller için yer tutucu.
import { Construction } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState.jsx';

/**
 * @param {{ title: string, description?: string, actions?: import('react').ReactNode }} props
 */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="type-h1">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** @param {{ item: { label: string, phase?: string|null } }} props */
export function ModulePlaceholder({ item }) {
  return (
    <>
      <PageHeader title={item.label} />
      <EmptyState
        icon={Construction}
        title="Bu modül henüz hazır değil"
        description={
          item.phase
            ? `Yol haritasında ${item.phase} fazında eklenecek. Menüdeki yeri ve yetkisi şimdiden tanımlı.`
            : 'Yakında eklenecek.'
        }
      />
    </>
  );
}
