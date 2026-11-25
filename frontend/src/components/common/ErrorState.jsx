// hata durumu: bölüm yüksekliğini korur, yeniden deneme sunar.
import { CircleAlert, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';

export function ErrorState({
  title = 'Şu anda yüklenemedi',
  description = 'Bağlantında ya da sunucuda geçici bir sorun olabilir.',
  onRetry,
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        'border-danger/30 bg-danger/5 flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border px-6 py-10 text-center',
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="text-danger size-6" />
      <div className="space-y-1">
        <p className="type-h3">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Tekrar dene
        </Button>
      )}
    </div>
  );
}
