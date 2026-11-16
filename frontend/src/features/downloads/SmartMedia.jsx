// FR-DL-06 — kart önizlemesi: görsel → WebP önizleme, GIF → GIF, MP4 → sessiz loop video yalnızca
// görünür alandayken oynar. Düşük efekt / reduced motion: poster, hover/focus (`active`) ile oynar.
import { useEffect, useRef, useState } from 'react';
import { useMotionFx } from '@/features/hero/useMotionFx.js';
import { cn } from '@/lib/utils';

function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(node);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

export function SmartMedia({ item, active = false, className }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const motion = useMotionFx();
  const shouldPlay = item.type === 'VIDEO' && (motion ? inView || active : active);

  useEffect(() => {
    const video = ref.current;
    if (!video || item.type !== 'VIDEO') return;
    if (shouldPlay) video.play?.()?.catch?.(() => {});
    else video.pause?.();
  }, [shouldPlay, item.type]);

  const base = cn('size-full object-cover', className);

  if (item.type === 'VIDEO') {
    return (
      <video
        ref={ref}
        src={item.previewUrl}
        poster={item.posterUrl ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        className={base}
      />
    );
  }
  return (
    <img
      ref={ref}
      src={item.type === 'ANIMATED_IMAGE' ? item.previewUrl : item.thumbUrl}
      alt=""
      loading="lazy"
      decoding="async"
      width={item.width ?? undefined}
      height={item.height ?? undefined}
      className={base}
    />
  );
}
