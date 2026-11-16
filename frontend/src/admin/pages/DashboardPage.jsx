// ADMIN.md §3.3, FR-DSH-01..03 — Dashboard: güvenlik uyarıları, KPI'lar (izinli ziyaretçiler),
// ziyaretçi grafiği (7/30/90 gün), en çok indirilen/görüntülenenler, son işlemler, entegrasyonlar,
// depolama. Ziyaretçi sayıları yalnızca analitik izni veren ziyaretçileri kapsar.
import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, ImageOff, TriangleAlert } from 'lucide-react';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { formatBytes, formatDateTime, formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { PageHeader } from '../components/PageHeader.jsx';
import { adminKeys, dashboardApi } from '../lib/adminApi.js';

export const RANGES = [
  { value: '7d', label: '7 gün' },
  { value: '30d', label: '30 gün' },
  { value: '90d', label: '90 gün' },
];

const WARNING_LINKS = {
  TWO_FACTOR_OFF: ['/admin/account?tab=2fa', 'Şimdi aç'],
  SMTP_MISSING: ['/admin/account?tab=mail', 'E-posta ayarlarına git'],
  INTEGRATION_ERROR: ['/admin/status', 'Durumlara git'],
  MEDIA_FAILED: ['/admin/media', 'Medyaya git'],
};

const KIND_LABELS = {
  BACKGROUND: 'Arka plan',
  MUSIC_AUDIO: 'Müzik',
  MUSIC_COVER: 'Müzik kapağı',
  PROFILE: 'Profil',
  CURSOR: 'Cursor',
  PROJECT_IMAGE: 'Proje görseli',
  LINK_IMAGE: 'Link görseli',
  FAVICON: 'Favicon',
  TECH_STACK_IMAGE: 'Tech Stack',
  NAME_OVERLAY: 'İsim Efekti',
  FALLING_IMAGE: 'Yağan öğe',
};
const KIND_COLORS = [
  'bg-primary',
  'bg-status-online',
  'bg-status-idle',
  'bg-status-dnd',
  'bg-[oklch(0.7_0.12_230)]',
  'bg-[oklch(0.72_0.12_320)]',
  'bg-muted-foreground',
];

const STATUS_DOT = {
  CONNECTED: 'bg-status-online',
  ERROR: 'bg-status-dnd',
  DISCONNECTED: 'bg-status-offline',
};
const STATUS_TEXT = { CONNECTED: 'Bağlı', ERROR: 'Hata', DISCONNECTED: 'Bağlı değil' };

const nf = new Intl.NumberFormat('tr-TR');

function Panel({ title, children, className, action }) {
  return (
    <section className={cn('bg-card rounded-[var(--radius-lg)] border p-5', className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="type-h3">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-card rounded-[var(--radius-lg)] border p-5">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="type-h1 mt-1 tabular-nums">{nf.format(value)}</p>
      <p className="text-muted-foreground mt-1 text-xs">izinli ziyaretçiler</p>
    </div>
  );
}

const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const tickFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const dayLabel = (day) => dayFmt.format(new Date(`${day}T00:00:00`));

/** Okunur üst sınır: 1-2-5 × 10ⁿ. */
function niceCeil(value) {
  if (value <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Günlük izinli ziyaretçi çubuk grafiği (kütüphane yok): eksen, ızgara, üzerine gelince değer. */
export function VisitorChart({ series }) {
  const max = Math.max(0, ...series.map((p) => p.count));
  const top = niceCeil(max);
  const total = series.reduce((a, p) => a + p.count, 0);
  const label = `${series.length} günde toplam ${nf.format(total)} izinli ziyaret; en yüksek günlük ${nf.format(Math.max(1, max))}.`;
  const every = Math.max(1, Math.ceil(series.length / 6));
  const ticks = [top, top / 2, 0];
  const lastTick = Math.floor((series.length - 1) / every) * every;
  // Son gün etiketi yalnızca önceki etiketle çakışmıyorsa.
  const showTick = (i) =>
    i % every === 0 || (i === series.length - 1 && i - lastTick >= Math.ceil(every * 0.6));

  return (
    <figure role="img" aria-label={label} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
      <div
        aria-hidden="true"
        className="text-muted-foreground flex h-52 flex-col justify-between py-0 text-right text-[11px] tabular-nums"
      >
        {ticks.map((t) => (
          <span key={t} className="-my-1.5 leading-3">
            {tickFmt.format(t)}
          </span>
        ))}
      </div>
      <div aria-hidden="true" className="relative h-52">
        {ticks.map((t, i) => (
          <span
            key={t}
            className={cn(
              'absolute inset-x-0 border-t',
              i === ticks.length - 1 ? 'border-border' : 'border-border/60 border-dashed',
            )}
            style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {series.map((p, i) => {
            const pct = (p.count / top) * 100;
            const last = i === series.length - 1;
            return (
              <div key={p.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-[3px] transition-[background-color,opacity] duration-150',
                    p.count === 0 ? 'bg-muted h-[2px]' : 'bg-primary/55 group-hover:bg-primary',
                    last && p.count > 0 && 'bg-primary',
                  )}
                  style={p.count > 0 ? { height: `max(${pct}%, 4px)` } : undefined}
                />
                <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md border px-2 py-1 text-xs whitespace-nowrap opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100">
                  <span className="text-muted-foreground">{dayLabel(p.day)}</span>{' '}
                  <span className="font-semibold tabular-nums">{nf.format(p.count)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {total === 0 && (
          <p className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">
            Bu aralıkta henüz izinli ziyaret yok.
          </p>
        )}
      </div>
      <span aria-hidden="true" />
      <div
        aria-hidden="true"
        className="text-muted-foreground flex gap-[3px] text-[11px] tabular-nums"
      >
        {series.map((p, i) => (
          <span
            key={p.day}
            className="flex flex-1 justify-center overflow-visible whitespace-nowrap"
          >
            {showTick(i) ? dayLabel(p.day) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

function Thumb({ url }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="bg-muted grid size-9 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-sm)]">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <ImageOff aria-hidden="true" className="text-muted-foreground size-4" />
      )}
    </span>
  );
}

function TopList({ items, empty, withThumb, href }) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ol className="grid gap-2">
      {items.map((item, i) => (
        <li key={item.id} className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground w-4 text-right tabular-nums">{i + 1}</span>
          {withThumb && <Thumb url={item.thumbUrl} />}
          {href ? (
            <Link to={href(item)} className="min-w-0 flex-1 truncate hover:underline">
              {item.title}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
          )}
          <span className="font-semibold tabular-nums">{nf.format(item.count)}</span>
        </li>
      ))}
    </ol>
  );
}

export function StorageBar({ storage }) {
  const total = storage.reduce((a, s) => a + s.bytes, 0);
  if (total === 0) {
    return <p className="text-muted-foreground text-sm">Henüz yüklenmiş medya yok.</p>;
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Toplam <span className="font-semibold">{formatBytes(total)}</span>
      </p>
      <div className="bg-muted flex h-3 overflow-hidden rounded-full" aria-hidden="true">
        {storage.map((s, i) => (
          <div
            key={s.kind}
            className={KIND_COLORS[i % KIND_COLORS.length]}
            style={{ width: `${(s.bytes / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {storage.map((s, i) => (
          <li key={s.kind} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('size-2.5 rounded-full', KIND_COLORS[i % KIND_COLORS.length])}
            />
            <span className="min-w-0 flex-1 truncate">{KIND_LABELS[s.kind] ?? s.kind}</span>
            <span className="text-muted-foreground tabular-nums">
              {formatBytes(s.bytes)} · {nf.format(s.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Warnings({ warnings }) {
  if (warnings.length === 0) return null;
  return (
    <section aria-label="Güvenlik uyarıları" className="grid gap-3 md:grid-cols-2">
      {warnings.map((w) => {
        const [to, cta] = WARNING_LINKS[w.code] ?? [];
        return (
          <div
            key={`${w.code}-${w.message}`}
            className="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-[var(--radius-lg)] border p-4"
          >
            <TriangleAlert aria-hidden="true" className="text-warning mt-0.5 size-5 shrink-0" />
            <div className="grid gap-1">
              <p className="text-sm font-medium">{w.message}</p>
              {to && (
                <Link
                  to={to}
                  className="text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                >
                  {cta}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function DashboardPage() {
  const admin = useAuthStore((s) => s.admin);
  const name = admin?.displayName || admin?.email?.split('@')[0];
  const [range, setRange] = useState('30d');
  const query = useQuery({
    queryKey: adminKeys.dashboard(range),
    queryFn: () => dashboardApi.summary(range),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });
  const d = query.data;

  return (
    <>
      <PageHeader
        title={`Merhaba, ${name}`}
        description="Ziyaretçi sayıları yalnızca analitik çerezine izin veren ziyaretçileri kapsar; haftalık ve aylık değerler günlük benzersizlerin toplamıdır (yaklaşık)."
      />
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.isPending && (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      )}
      {d && (
        <div className="grid gap-6">
          <Warnings warnings={d.warnings} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Toplam" value={d.visitors.total} />
            <Kpi label="Bugün" value={d.visitors.today} />
            <Kpi label="Son 7 gün" value={d.visitors.week} />
            <Kpi label="Son 30 gün" value={d.visitors.month} />
          </div>

          <Panel
            title="Ziyaretçiler"
            action={
              <div role="group" aria-label="Aralık" className="flex gap-1">
                {RANGES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={range === r.value}
                    onClick={() => setRange(r.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-colors',
                      range === r.value
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            }
          >
            <VisitorChart series={d.visitors.series} />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="En çok indirilen duvar kağıtları">
              <TopList items={d.topWallpapers} empty="Henüz indirme yok." withThumb />
            </Panel>
            <Panel title="En çok indirilen profil fotoğrafları">
              <TopList items={d.topPfps} empty="Henüz indirme yok." withThumb />
            </Panel>
            <Panel title="En çok görüntülenen projeler">
              <TopList
                items={d.topProjects}
                empty="Henüz görüntülenme yok."
                href={(p) => `/admin/projects/${p.id}`}
              />
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Panel title="Son işlemler">
              {d.recentAudit.length === 0 ? (
                <p className="text-muted-foreground text-sm">Gösterilecek işlem yok.</p>
              ) : (
                <ul className="divide-border divide-y text-sm">
                  {d.recentAudit.map((a) => (
                    <li key={a.id} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{a.action}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {a.actor}
                          {a.entityType ? ` · ${a.entityType}` : ''}
                        </span>
                      </span>
                      <time
                        dateTime={a.createdAt}
                        title={formatDateTime(a.createdAt)}
                        className="text-muted-foreground shrink-0 text-xs"
                      >
                        {formatRelative(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <div className="grid content-start gap-6">
              <Panel title="Entegrasyonlar">
                <ul className="grid gap-2 text-sm">
                  {d.integrations.map((i) => (
                    <li key={i.provider} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-2.5 rounded-full',
                          i.isEnabled ? STATUS_DOT[i.status] : 'bg-status-offline',
                        )}
                      />
                      <span className="flex-1">{i.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {i.isEnabled ? STATUS_TEXT[i.status] : 'Kapalı'}
                        {i.lastSyncAt ? ` · ${formatRelative(i.lastSyncAt)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Depolama">
                <StorageBar storage={d.storage} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
