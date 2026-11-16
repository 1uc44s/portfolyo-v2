// FR-ROT-09, RULES.md §3.9 — takvim günü hesapları yalnızca buradan (Europe/Istanbul).
// Sunucunun saat dilimine bağımlı değildir.
export const TIME_ZONE = 'Europe/Istanbul';

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const offsetParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  timeZoneName: 'longOffset',
});

/** İstanbul takvim günü: "YYYY-MM-DD". @param {Date|number} [now] */
export const istanbulDate = (now = Date.now()) => dateParts.format(now);

/** "YYYY-MM-DD" → Prisma @db.Date değeri (UTC gece yarısı). */
export const toDbDate = (day) => new Date(`${day}T00:00:00.000Z`);

/** @db.Date değeri → "YYYY-MM-DD". */
export const fromDbDate = (date) => date.toISOString().slice(0, 10);

/** Gün ekler/çıkarır (takvim aritmetiği). */
export function addDays(day, amount) {
  const date = toDbDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return fromDbDate(date);
}

/** İstanbul'un o andaki UTC farkı, dakika (ör. +180). */
function offsetMinutes(at) {
  const name = offsetParts.formatToParts(at).find((p) => p.type === 'timeZoneName').value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** Verilen İstanbul gününün başlangıç anı (00:00 yerel). */
export function istanbulMidnight(day) {
  const utcMidnight = toDbDate(day).getTime();
  // Farkı o günün öğlesinden ölç (yaz saati geçişlerinde güvenli).
  const offset = offsetMinutes(new Date(utcMidnight + 12 * 3600_000));
  return new Date(utcMidnight - offset * 60_000);
}

/** Bir sonraki İstanbul 00:00 anı. @param {Date|number} [now] */
export const nextIstanbulMidnight = (now = Date.now()) =>
  istanbulMidnight(addDays(istanbulDate(now), 1));
