// Lazy chunk yüklenirken tam sayfa iskelet (boş/beyaz ekran yok).
export function FullPageSkeleton({ label = 'Yükleniyor' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="scene-fallback grid min-h-dvh place-items-center px-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="bg-surface-2 size-12 animate-pulse rounded-full" />
        <div className="bg-surface-2 h-3 w-40 animate-pulse rounded-full" />
        <div className="bg-surface-2 h-3 w-24 animate-pulse rounded-full" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
