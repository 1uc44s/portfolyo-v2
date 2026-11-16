// Tarih/süre/boyut biçimlendirme (tr-TR, Europe/Istanbul).
const TIME_ZONE = 'Europe/Istanbul';

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
});

const relative = new Intl.RelativeTimeFormat('tr-TR', { numeric: 'auto' });

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export const formatDateTime = (value) => (value ? dateTime.format(new Date(value)) : '—');

export function formatRelative(value, now = Date.now()) {
  if (!value) return '—';
  const seconds = Math.round((new Date(value).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'az önce';
}

/** User-agent'tan kısa, insan okunur cihaz etiketi. */
export function describeUserAgent(ua = '') {
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    null;
  const os =
    (/Windows/.test(ua) && 'Windows') ||
    (/Android/.test(ua) && 'Android') ||
    (/(iPhone|iPad)/.test(ua) && 'iOS') ||
    (/Mac OS X/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    null;
  if (browser && os) return `${browser} · ${os}`;
  return browser ?? os ?? 'Bilinmeyen cihaz';
}

/** Bayt → okunur boyut (tr-TR, 1 ondalık). */
export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toLocaleString('tr-TR', { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}
