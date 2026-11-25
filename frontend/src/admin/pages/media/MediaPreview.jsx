// medya önizlemeleri (yetkili blob): görsel/GIF (döngüde), video (hover/odakta oynar),
// müzik mini oynatıcısı ve durum rozetleri.
import { useState } from 'react';
import { CircleAlert, ImageOff, Loader2, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { cn } from '@/lib/utils';
import { useAuthedMedia } from '../../lib/useAuthedMedia.js';
import { isBusy, statusBadges } from './mediaConfig.js';

const TONES = {
  success: 'border-success/40 text-success bg-success/10',
  muted: 'text-muted-foreground',
  warning: 'border-warning/50 text-warning bg-warning/10',
  danger: 'border-danger/50 text-danger bg-danger/10',
};

export function StatusBadges({ item, className }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {statusBadges(item).map((badge) => (
        <Badge key={badge.label} variant="outline" className={TONES[badge.tone]}>
          {isBusy(item.status) && <Loader2 aria-hidden="true" className="animate-spin" />}
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function Placeholder({ asset, className }) {
  const failed = asset?.processingStatus === 'FAILED';
  const Icon = failed ? CircleAlert : isBusy(asset?.processingStatus) ? Loader2 : ImageOff;
  return (
    <div
      className={cn(
        'bg-surface-2 text-muted-foreground grid place-items-center gap-1 p-2 text-center text-xs',
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('size-5', !failed && isBusy(asset?.processingStatus) && 'animate-spin')}
      />
      <span>
        {failed ? 'İşlenemedi' : isBusy(asset?.processingStatus) ? 'İşleniyor…' : 'Önizleme yok'}
      </span>
    </div>
  );
}

/** Statik varyant: thumb varsa thumb; GIF'te döngü için main; cursor'da piksel keskin. */
function stillUrl(asset) {
  if (asset.mediaType === 'ANIMATED_IMAGE' || asset.mediaType === 'CURSOR') return asset.previewUrl;
  return asset.thumbUrl ?? asset.posterUrl ?? asset.previewUrl;
}

/**
 * @param {{ asset: object|null, alt?: string, className?: string, fit?: 'cover'|'contain' }} props
 */
export function MediaPreview({ asset, alt = '', className, fit = 'cover' }) {
  const [hovered, setHovered] = useState(false);
  const ready = asset?.processingStatus === 'READY';
  const isVideo = asset?.mediaType === 'VIDEO';
  const still = useAuthedMedia(ready ? stillUrl(asset) : null);
  const video = useAuthedMedia(ready && isVideo ? asset.previewUrl : null, { enabled: hovered });

  if (!ready || still.isError) return <Placeholder asset={asset} className={className} />;
  const media = cn(
    'size-full',
    fit === 'cover' ? 'object-cover' : 'object-contain',
    asset.mediaType === 'CURSOR' && '[image-rendering:pixelated]',
  );
  return (
    <div
      className={cn('bg-surface-2 relative overflow-hidden', className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {hovered && video.src ? (
        <video src={video.src} className={media} muted loop autoPlay playsInline aria-label={alt} />
      ) : still.src ? (
        <img src={still.src} alt={alt} className={media} draggable={false} />
      ) : (
        <div className="bg-surface-3 size-full animate-pulse" />
      )}
      {isVideo && (
        <span className="bg-background/80 type-meta absolute top-2 right-2 rounded px-1.5 py-0.5">
          MP4
        </span>
      )}
    </div>
  );
}

/** Müzik mini oynatıcısı: dosya ilk "Dinle"de çekilir, sonra yerel <audio> kontrolleri. */
export function MiniAudioPlayer({ asset, title }) {
  const [requested, setRequested] = useState(false);
  const ready = asset?.processingStatus === 'READY';
  const audio = useAuthedMedia(ready ? asset.previewUrl : null, { enabled: requested });
  if (!ready) return null;
  if (!requested || !audio.src) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={requested && audio.isLoading}
        onClick={() => setRequested(true)}
      >
        {requested && audio.isLoading ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Play aria-hidden="true" />
        )}
        Dinle
      </Button>
    );
  }
  return (
    <audio src={audio.src} controls autoPlay className="h-9 w-full" aria-label={`${title} — dinle`}>
      <track kind="captions" />
    </audio>
  );
}
