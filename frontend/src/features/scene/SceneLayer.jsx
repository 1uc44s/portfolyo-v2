// günün arka planı tüm ekranı kaplar; arada saydam katman yok (2026-11-16 kullanıcı isteği).
// Video her cihazda oynar; tarayıcı ekrana uygun kopyayı seçer (≤ 900 px: 720p,
// ≤ 2400 px: 1080p, daha büyük: 4K'ya kadar ana kopya). Yalnızca veri tasarrufu / 2G-3G'de poster.
// Önce poster görünür, video arkadan yüklenir (ilk açılış beklemez).
import { useEffect, useState } from 'react';
import { useSite } from '@/features/site/useSite.js';
import { usePrefs } from '@/lib/prefs.js';

function canPlayVideo() {
  if (typeof window === 'undefined') return false;
  const connection = navigator.connection;
  return !(connection?.saveData || /(^|-)2g|3g/.test(connection?.effectiveType ?? ''));
}

export function SceneLayer() {
  const { data } = useSite();
  // Sitenin efekt düğmesi (navbar rüzgâr simgesi). Kapalıyken video durur, poster kalır.
  const low = usePrefs((s) => s.effects === 'low');
  const [videoAllowed, setVideoAllowed] = useState(false);
  useEffect(() => setVideoAllowed(canPlayVideo()), []);

  const bg = data?.today?.background;
  const isVideo = bg?.type === 'VIDEO';
  const stillUrl = isVideo ? bg.posterUrl : bg?.url;

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      <div className="scene-fallback absolute inset-0" />
      {isVideo && videoAllowed && !low ? (
        <video
          // Kaynak listesi değişince (yeni gün) video yeniden yüklensin.
          key={bg.url}
          className="absolute inset-0 size-full object-cover"
          poster={bg.posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          {(bg.sources ?? []).map((s) => (
            <source
              key={s.url}
              src={s.url}
              type="video/mp4"
              media={`(max-width: ${s.maxWidth}px)`}
            />
          ))}
          <source src={bg.url} type="video/mp4" />
        </video>
      ) : (
        stillUrl && (
          <img
            className="absolute inset-0 size-full object-cover"
            src={stillUrl}
            alt=""
            decoding="async"
          />
        )
      )}
    </div>
  );
}
